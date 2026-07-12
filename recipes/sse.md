# Server-sent events

`Sse(config)` bridges **omnicast actions** across every connected client &mdash; other tabs, browsers, and devices &mdash; through a Server-Sent Events server. Omnicast is to the network what broadcast is to the `<Boundary>`: within the local Boundary an omnicast action behaves exactly like a broadcast (subscribe with `useAction`, render with `stream`), but dispatching it through the bridge also carries it to every other connected client, whose bridge re-dispatches it locally. Subscribers cannot tell local from remote.

The reference server is [Akela](https://github.com/Wildhoney/Akela) &mdash; a Rust SSE hub that fans out through Redis pub/sub so any number of server instances behave as one. Any server speaking the same protocol works:

| Route                          | Method           | Purpose                                                      |
| ------------------------------ | ---------------- | ------------------------------------------------------------ |
| `/sse?tags=a,b`                | `GET`            | Connect; the first event is `connected` with the client id.  |
| `/send`                        | `POST`           | Publish `{ "data": ..., "tags": [...]?, "client": "..."? }`. |
| `/clients/{client}/tags/{tag}` | `PUT` / `DELETE` | Add or remove a tag on a connection.                         |

## Declaring omnicast actions

Declare omnicast actions with `Omnicast(name, schema?)` &mdash; the sibling of `Action(name, Distribution.Broadcast)`. The payload type is **inferred from the schema**, so the compile-time type and the runtime validator can never drift apart. Any Zod-style validator satisfies the contract (a `parse(value)` method that returns the typed value or throws); Zod is the recommended choice:

```ts
import { Action, Distribution, Omnicast as Omni } from "march-hare";
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
    static Adopted = Omni("Cat.Adopted", Payload.Adoption);
  }

  export class Cattery {
    static Opened = Omni("Cattery.Opened");
  }
}
```

Omit the schema for payloadless events. Payloads must survive `JSON.stringify` round-trips.

The schema earns its keep at the trust boundary: a server-sent event is remote input, so every envelope arriving over the wire is run through the action's `parse` before it is dispatched. An envelope that fails validation is **rejected** &mdash; logged with `console.warn` and never reaches your handlers &mdash; so a misbehaving peer or server cannot push malformed payloads into your Boundary. Outgoing dispatches are parsed too, failing fast on the sender before anything reaches the wire.

## Declaring a bridge

Declare the bridge at module scope, next to your resources. The `actions` class &mdash; the **wire class** &mdash; lists the omnicast actions permitted to travel; incoming envelopes naming anything else are discarded, so it doubles as an allow-list guarding what a remote peer may dispatch into your Boundary.

```ts
import { Sse } from "march-hare";
import { Omnicast } from "@example/shared/types/index.ts";

export class Wire {
  static Adopted = Omnicast.Cat.Adopted;
  static Opened = Omnicast.Cattery.Opened;
}

export const sse = Sse({
  url: "http://localhost:8080",
  actions: Wire,
});
```

Non-omnicast members are ignored at lookup time, and `sse.dispatch` refuses plain broadcast actions at runtime &mdash; declare anything wire-bound with `Omnicast()`.

## Mounting

Mount the bridge **once** inside the `<Boundary>` whose components should receive remote dispatches &mdash; typically the page-level actions hook. A second concurrent mount throws.

```ts
export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ cats: [] });

  sse.useBridge();

  actions.useAction(Actions.Broadcast.Cat.Added, (context, cat) => {
    context.actions.produce(({ model }) => void model.cats.push(cat));
  });

  return actions;
}
```

The connection lives for the hosting component's lifetime and closes on unmount. `EventSource` reconnects automatically after a network drop; the bridge re-reads the client id from the `connected` event and re-applies any tag mutations the connection made before the drop.

## Dispatching

`sse.dispatch` has the same call signature as `actions.dispatch`, typed against the wire class:

```ts
actions.useAction(Actions.Click, async (context) => {
  const [image] = await context.actions.resource(resource.cat.image());
  if (G.isNullable(image)) return;

  const adoption: Payload.Adoption = {
    image,
    cat: { id: image.id, name: name(), avatar: image.url, filter: filter() },
  };
  await sse.dispatch(Actions.Omnicast.Cat.Adopted, adoption);
});
```

One call performs both legs:

1. **Local** &mdash; the action dispatches into the Boundary immediately, exactly as `context.actions.dispatch` would.
2. **Remote** &mdash; the envelope `{ name, payload }` is published to the server, attributed with the connection's client id. The server delivers it to every other client and **excludes the sender**, so the local leg is the only delivery on the dispatching client &mdash; no double-fire.

The returned promise resolves when the local handlers have completed and the server has accepted the publish; a failed publish (or an outgoing payload failing its schema) rejects and surfaces through the normal fault pipeline of the dispatching handler.

Because payloads are broadcast verbatim, generate any derived values **once** on the dispatching client and carry them in the payload. In the example above the cat's `name()` and `filter()` are rolled before dispatch &mdash; if each client generated its own, every tab would show a different cat.

## Tags

Connections hold a mutable set of tags, seeded from `config.tags` and mutated at runtime:

```ts
await sse.tag.add("vip");
await sse.tag.remove("vip");
```

`sse.dispatch` publishes publicly &mdash; every client receives it. To target a subset, bind tags first; delivery then requires the receiving client to hold **all** of the supplied tags (holding extras is fine):

```ts
await sse.tagged(["vip"]).dispatch(Actions.Omnicast.Cat.Adopted, adoption);
```

The local leg is unaffected by tags &mdash; the dispatching Boundary always receives its own dispatch.

Tag mutations are remembered on the handle and re-applied after every reconnect, because a reconnecting `EventSource` reverts the server to the query-string tags.

## Boundary isolation

The bridge inherits March Hare's isolation rules: incoming actions dispatch into the Boundary that mounted `useBridge()`, and only that Boundary. Two Boundaries needing remote events need two `Sse` handles &mdash; one each &mdash; and mounting one handle in two Boundaries is refused at mount time.

## Testing

`jsdom` does not implement `EventSource`. Stub the constructor surface in your test setup &mdash; the bridge only needs `addEventListener` and `close`, and with no events arriving the client id stays `null`, which also disables the sender-exclusion field on `POST /send`:

```ts
class EventSourceStub {
  addEventListener(): void {}
  close(): void {}
}
```

## Limitations

- **Live notifications, not a durable queue.** Events published while a client is disconnected are not replayed. Treat SSE as the invalidation/announce layer and keep Resources as the source of truth for state that must survive a reconnect.
- **One mount per handle.** A handle owns a single connection; mount `useBridge()` once per application (per Boundary).
- **Omnicast actions only.** Unicast and multicast actions have component- and scope-relative semantics that do not survive serialisation to another client, and plain broadcasts carry no schema to validate remote input against &mdash; `sse.dispatch` refuses them.
