# Omnicast actions over SSE

Omnicast is the fourth distribution: one ring further out than broadcast. A broadcast action reaches every component inside its `<Boundary>`; an **omnicast** action additionally reaches every other connected client &mdash; other tabs, browsers, and devices &mdash; through a Server-Sent Events server. There is no separate transport API to learn: declare the action with `Distribution.Omnicast`, point the App at an SSE endpoint, and dispatch it exactly like any other action. Subscribers `useAction` it as usual and cannot tell a local dispatch from a remote one.

```ts
export class Cattery {
  static Opened = Action("Cattery.Opened", Distribution.Omnicast());
}

// Somewhere in a handler — one call, local + every other client:
await context.actions.dispatch(
  Actions.Omnicast.Cattery.Opened,
  Audience.Public(),
);
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

The schema earns its keep at the trust boundary: a server-sent event is remote input, so every envelope arriving over the wire is run through the action's `parse` before it is dispatched. An envelope that fails validation is **rejected** and never reaches your subscribers &mdash; instead a `Rejected` error (the validator's error preserved on `cause`) is raised through the boundary's fault pipeline as `Reason.Rejected`, so your existing `Lifecycle.Fault` subscriber observes misbehaving peers the same way it observes any other failure:

```ts
actions.useAction(Lifecycle.Fault, (context, fault) => {
  if (fault.reason === Reason.Rejected) {
    Sentry.captureException(fault.error, { tags: { action: fault.action } });
  }
});
```

Outgoing dispatches are parsed too, failing fast on the sender before anything reaches the wire: the dispatch rejects with the same `Rejected` error, surfacing through the dispatching handler's `Lifecycle.Error()` and the global `Lifecycle.Fault` with `Reason.Rejected`.

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

One dispatch call performs both legs, and every omnicast dispatch **must** declare its audience &mdash; the second argument, before the payload, required by the types, because an event leaving the machine should never be public by accident:

```ts
actions.useAction(Actions.Click, async (context) => {
  const [image] = await context.actions.resource(resource.cat.image());
  if (G.isNullable(image)) return;

  const adoption: Payload.Adoption = {
    image,
    cat: { id: image.id, name: name(), avatar: image.url, filter: filter() },
  };
  await context.actions.dispatch(
    Actions.Omnicast.Cat.Adopted,
    Audience.Public(),
    adoption,
  );
});

actions.useAction(Actions.Omnicast.Cat.Adopted, async (context, adoption) => {
  context.actions.produce(({ model }) => void (model.image = adoption.image));
  await context.actions.dispatch(Actions.Broadcast.Cat.Added, adoption.cat);
});
```

1. **Local** &mdash; the action dispatches into the Boundary immediately, exactly like a broadcast, including value caching for late-mounting subscribers.
2. **Remote** &mdash; the envelope `{ name, payload, channel? }` is published to the server, attributed with the connection's client id. The server delivers it to every other client and **excludes the sender**, so the local leg is the only delivery on the dispatching client &mdash; no double-fire.

The returned promise resolves when the local handlers have completed and the server has accepted the publish; a failed publish (or an outgoing payload failing its schema) rejects and surfaces through the normal fault pipeline of the dispatching handler.

Because payloads are broadcast verbatim, generate any derived values **once** on the dispatching client and carry them in the payload. In the example above the cat's `name()` and `filter()` are rolled before dispatch &mdash; if each client generated its own, every tab would show a different cat.

## Audiences and tags

`Audience.Public()` delivers to every connected client. `Audience.Private(tags)` delivers only to clients holding **all** of the supplied tags (holding extras is fine); at least one tag is required &mdash; the parameter type demands a non-empty tuple, since an empty list would silently behave as public. The local leg is unaffected either way &mdash; the dispatching Boundary always receives its own dispatch.

```ts
await context.actions.dispatch(
  Actions.Omnicast.Cat.Adopted,
  Audience.Private(["vip"]),
  adoption,
);
```

Connections hold a mutable set of tags, seeded from `sse.tags` in the App config and mutated from any handler via `context.actions.tag`:

```ts
actions.useAction(Actions.SignedIn, async (context, session) => {
  await context.actions.tag.add(`user-${session.id}`, session.plan, "beta");
});

actions.useAction(Actions.Downgraded, async (context, session) => {
  await context.actions.tag.remove("vip", "beta");
});

actions.useAction(Actions.SignedOut, async (context) => {
  await context.actions.tag.clear();
});
```

`tag.add` / `tag.remove` / `tag.clear` change which `Audience.Private(...)` dispatches this client receives. `add` and `remove` are variadic and take at least one tag; both are idempotent &mdash; only tags that actually change the set reach the server, so adding an already-held tag or removing an absent one is a no-op. `tag.has("vip", "beta")` reads the set synchronously and is true only when the connection holds **all** of the supplied tags &mdash; the same all-of semantics `Audience.Private` uses for delivery. Mutations are remembered on the connection and re-applied after every reconnect, because a reconnecting `EventSource` reverts the server to the query-string tags. When the App has no `sse` endpoint configured the mutators resolve as no-ops and `has` returns `false`, keeping components portable.

## Channeled omnicast

Omnicast actions support channels exactly like broadcast actions &mdash; declare the channel shape alongside the payload schema, then call the action at the dispatch and subscribe sites. The channel travels inside the wire envelope, and each receiving client applies the same subscriber-filter matching as a local channeled dispatch:

```ts
export class Cat {
  static Renamed = Action(
    "Cat.Renamed",
    Distribution.Omnicast<Payload.Cat, { Id: string }>(Payload.Cat),
  );
}

// Subscribe to one cat's renames — locally or from any client:
actions.useAction(Actions.Omnicast.Cat.Renamed({ Id: cat.id }), handler);

// Dispatch targeted at that cat, everywhere:
await context.actions.dispatch(
  Actions.Omnicast.Cat.Renamed({ Id: cat.id }),
  Audience.Public(),
  renamed,
);
```

Matching follows the usual rule: every key the subscriber supplies must be present and equal on the dispatch channel, and uncalled subscriptions hear every dispatch. Because the channel is serialised into the envelope, channel values must be JSON-safe primitives (`string`, `number`, `boolean`) &mdash; `symbol` and `bigint` channels cannot cross the wire.

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
- **Channels filter subscribers; audiences filter clients.** A channel travels in the envelope and selects which handlers fire on each receiving client, but every matching-tag client still receives the envelope. Use `Audience.Private(tags)` when the event should not reach a client at all.
