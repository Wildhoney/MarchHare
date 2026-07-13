# Omnicast actions over SSE

Omnicast is the fourth distribution: one ring further out than broadcast. A broadcast action reaches every component inside its `<Boundary>`; an **omnicast** action additionally reaches every other connected client &mdash; other tabs, browsers, and devices &mdash; through a Server-Sent Events server. There is no separate transport API to learn: declare the action with `Distribution.Omnicast`, point the App at an SSE endpoint, and dispatch it exactly like any other action. Subscribers `useAction` it as usual and cannot tell a local dispatch from a remote one.

```ts
export class Cattery {
  static Opened = Action("Cattery.Opened", Distribution.Omnicast());
}

// Somewhere in a handler — one call, local + every other client:
await context.actions.dispatch(Actions.Omnicast.Cattery.Opened);
```

The reference server is [Akela](https://github.com/Wildhoney/Akela) &mdash; a Rust SSE hub that fans out through Redis pub/sub so any number of server instances behave as one. Any server speaking the same protocol works:

| Route                          | Method           | Purpose                                                      |
| ------------------------------ | ---------------- | ------------------------------------------------------------ |
| `/sse?tags=a,b`                | `GET`            | Connect; the first event is `connected` with the client id.  |
| `/send`                        | `POST`           | Publish `{ "data": ..., "tags": [...]?, "client": "..."? }`. |
| `/clients/{client}/tags/{tag}` | `PUT` / `DELETE` | Add or remove a tag on a connection.                         |

## Declaring omnicast actions

`Distribution.Omnicast(schema?)` takes a Zod-style schema (any object exposing a `parse(value)` method &mdash; Zod is the recommended choice) and the payload type is **inferred from it**, so the compile-time type and the runtime validator can never drift apart:

```ts
import { Action, Distribution } from "march-hare";
import { z } from "zod";

export namespace Payload {
  export const Cat = z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string(),
    filter: z.enum(filters),
  });
  export type Cat = z.infer<typeof Cat>;

  export const Adoption = z.object({
    image: z.object({
      id: z.string(),
      url: z.string(),
      width: z.number(),
      height: z.number(),
    }),
    cat: Cat,
  });
  export type Adoption = z.infer<typeof Adoption>;
}

export namespace Omnicast {
  export class Cat {
    static Adopted = Action(
      "Cat.Adopted",
      Distribution.Omnicast(Payload.Adoption),
    );
  }

  export class Cattery {
    static Opened = Action("Cattery.Opened", Distribution.Omnicast());
  }
}
```

Omit the schema for payloadless events. Payloads must survive `JSON.stringify` round-trips.

The schema earns its keep at the trust boundary: a server-sent event is remote input, so every envelope arriving over the wire is run through the action's `parse` before it is dispatched. An envelope that fails validation is **rejected** &mdash; logged with `console.warn` and never reaching your handlers &mdash; so a misbehaving peer or server cannot push malformed payloads into your Boundary. Outgoing dispatches are parsed too, failing fast on the sender before anything reaches the wire.

## Sharing the action classes: `AppActions`

Group the cross-cutting distributions on a single `AppActions` base class and have each component's `Actions` extend it, rather than re-assigning `Broadcast`/`Omnicast` statics in every file:

```ts
// shared/types/index.ts
export class AppActions {
  static Broadcast = Broadcast;
  static Omnicast = Omnicast;
}

// features/add-cat/types.ts
export class Actions extends AppActions {
  static Click = Action("AddCat.Click");
}

// app/pages/cattery/types.ts
export class Actions extends AppActions {
  static OpenNew = Action("Cattery.OpenNew");
}
```

`Actions.Omnicast.Cat.Adopted` then resolves through static inheritance and stays fully typed at `dispatch`/`useAction` call sites.

## Configuring the App

Supply the endpoint once on the App; the Boundary owns the connection lifecycle from there &mdash; it connects on mount, disconnects on unmount, rides `EventSource`'s automatic reconnection, and re-applies tag mutations after every reconnect. There is nothing to mount and no hook to call.

```ts
import { App } from "march-hare";
import { Env, Omnicast } from "@example/shared/types/index.ts";

export const app = App<Env.Cat>({
  env: { apiBase: "https://api.thecatapi.com/v1" },
  sse: { url: "http://localhost:8080", actions: Omnicast },
});
```

`sse.actions` is the allow-list: incoming envelopes naming any action outside it are discarded. Pass the `Omnicast` namespace directly &mdash; nested classes are walked &mdash; or a flat class of specific actions when you want a narrower surface. `sse.tags` optionally seeds the connection's tag set.

Omit `sse` entirely and omnicast actions degrade gracefully to plain broadcasts &mdash; components stay portable between connected and unconnected Apps, including under test.

## Dispatching

One dispatch call performs both legs:

```ts
actions.useAction(Actions.Click, async (context) => {
  const [image] = await context.actions.resource(resource.cat.image());
  if (G.isNullable(image)) return;

  const adoption: Payload.Adoption = {
    image,
    cat: { id: image.id, name: name(), avatar: image.url, filter: filter() },
  };
  await context.actions.dispatch(Actions.Omnicast.Cat.Adopted, adoption);
});

actions.useAction(Actions.Omnicast.Cat.Adopted, async (context, adoption) => {
  context.actions.produce(({ model }) => void (model.image = adoption.image));
  await context.actions.dispatch(Actions.Broadcast.Cat.Added, adoption.cat);
});
```

1. **Local** &mdash; the action dispatches into the Boundary immediately, exactly like a broadcast, including value caching for late-mounting subscribers.
2. **Remote** &mdash; the envelope `{ name, payload }` is published to the server, attributed with the connection's client id. The server delivers it to every other client and **excludes the sender**, so the local leg is the only delivery on the dispatching client &mdash; no double-fire.

The returned promise resolves when the local handlers have completed and the server has accepted the publish; a failed publish (or an outgoing payload failing its schema) rejects and surfaces through the normal fault pipeline of the dispatching handler.

Because payloads are broadcast verbatim, generate any derived values **once** on the dispatching client and carry them in the payload. In the example above the cat's `name()` and `filter()` are rolled before dispatch &mdash; if each client generated its own, every tab would show a different cat.

## Tags

Connections hold a mutable set of tags, seeded from `sse.tags` in the App config. Dispatches are public by default; pass `tags` as dispatch options to narrow the wire delivery to clients holding **all** of the supplied tags (holding extras is fine):

```ts
await context.actions.dispatch(Actions.Omnicast.Cat.Adopted, adoption, {
  tags: ["vip"],
});
```

The local leg is unaffected by tags &mdash; the dispatching Boundary always receives its own dispatch.

## Boundary isolation

Omnicast inherits March Hare's isolation rules on the local side: incoming envelopes dispatch into the Boundary whose App carries the `sse` config, and only that Boundary. Two Boundaries each configured with an endpoint hold two independent connections.

## Testing

`jsdom` does not implement `EventSource`. Stub the constructor surface in your test setup &mdash; the connection only needs `addEventListener` and `close`, and with no events arriving the client id stays `null`, which also disables the sender-exclusion field on `POST /send`:

```ts
class EventSourceStub {
  addEventListener(): void {}
  close(): void {}
}
```

## Limitations

- **Live notifications, not a durable queue.** Events published while a client is disconnected are not replayed. Treat SSE as the invalidation/announce layer and keep Resources as the source of truth for state that must survive a reconnect.
- **Omnicast only.** Unicast and multicast actions have component- and scope-relative semantics that do not survive serialisation to another client, and plain broadcasts carry no schema to validate remote input against &mdash; they stay inside the Boundary.
- **Channels do not cross the wire.** Channeled dispatch filtering is a local concern; use tags to target subsets of clients instead.
