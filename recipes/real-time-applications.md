# Real-time applications

March Hare's lifecycle actions make it easy to integrate with real-time data sources like Server-Sent Events (SSE), WebSockets, or any event-based API. Use `Lifecycle.Mount()` to establish connections and `Lifecycle.Unmount()` to clean them up.

This recipe covers two patterns:

1. **Model-driven** &mdash; the simple case where incoming events update local model state.
2. **Cache-driven** &mdash; pushing incoming events into a Resource's cache so the rest of the app (other components, fetchers using `.exceeds({...})`) sees the fresh value without an extra round-trip.

## Pattern 1: model-driven (visitor stream)

Tracks website visitors in real-time using SSE:

```ts
import { Action, Lifecycle } from "march-hare";
import { app } from "./app";

type Country = { name: string; flag: string; timestamp: number };

type Model = {
  visitor: Country | null;
  history: Country[];
  source: EventSource | null;
};

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Visitor = Action<Country>("Visitor");
}

const initial: Model = { visitor: null, history: [], source: null };

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(initial);

  actions.useAction(Actions.Mount, (context) => {
    const source = new EventSource("/visitors");
    source.addEventListener("visitor", (event) => {
      context.actions.dispatch(
        Actions.Visitor,
        JSON.parse(event.data) as Country,
      );
    });
    context.actions.produce(({ model }) => void (model.source = source));
  });

  actions.useAction(Actions.Visitor, (context, country) => {
    context.actions.produce(({ model }) => {
      model.visitor = country;
      model.history = [country, ...model.history].slice(0, 20);
    });
  });

  actions.useAction(Actions.Unmount, (context) => {
    context.model.source?.close();
  });

  return actions;
}
```

Key patterns:

- **Connection in `Lifecycle.Mount()`** &mdash; establish the SSE connection when the component mounts; store the `EventSource` in the model for later cleanup.
- **Event-driven dispatches** &mdash; when SSE events arrive, dispatch actions to update the model, triggering efficient re-renders.
- **Cleanup in `Lifecycle.Unmount()`** &mdash; close the connection when the component unmounts to prevent memory leaks.

See the full implementation in the [Visitor example source code](https://github.com/Wildhoney/MarchHare/blob/main/src/example/visitor/actions.ts).

## Pattern 2: cache invalidation from SSE pushes

When a Resource is the canonical source of some data and a real-time controller carries updates for the same payload, broadcast the event and evict the stale cache slot so the next read refetches against the fresh server state:

```ts
// resources.ts
import { app } from "./app";

export const user = app.Resource<User, { id: number }>(
  ({ controller, params }) =>
    ky
      .get(`/api/users/${params.id}`, { signal: controller.signal })
      .json<User>(),
);
```

```ts
// stream/actions.ts
import { Action, Distribution, Lifecycle } from "march-hare";
import { app } from "./app";
import * as resource from "./resources";

class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();

  static Broadcast = {
    UserUpdated: Action<{ id: number }>("UserUpdated", Distribution.Broadcast),
  };
}

type Model = {
  source: EventSource | null;
};

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ source: null });

  actions.useAction(Actions.Mount, (context) => {
    const source = new EventSource("/users/stream");
    source.addEventListener("user.updated", (event) => {
      const { id } = JSON.parse(event.data) as { id: number };
      context.actions.dispatch(Actions.Broadcast.UserUpdated, { id });
    });
    context.actions.produce(({ model }) => void (model.source = source));
  });

  actions.useAction(Actions.Broadcast.UserUpdated, (context, { id }) => {
    context.actions.resource(resource.user({ id })).evict();
  });

  actions.useAction(Actions.Unmount, (context) => {
    context.model.source?.close();
  });

  return actions;
}
```

Why route through a broadcast action rather than calling `.evict()` directly inside the SSE listener?

- **Fan-out.** Multiple components can listen for `UserUpdated` (a profile screen refetching, an avatar re-rendering) while the cache itself gets one canonical eviction.
- **Cancellation.** The action handler's signal short-circuits the evict when a component unmounts mid-event.

## Pattern 3: partial-match invalidation

When a single event invalidates several cache slots, `.evict(where)` walks the resource's known params and drops every match. Pattern matching is partial &mdash; extra keys in the stored params are ignored:

```ts
actions.useAction(Actions.Broadcast.TeamUpdated, (context, { teamId }) => {
  context.actions.resource(resource.user()).evict({ teamId });
});
```

For a global purge across every resource on the App, reach for `context.actions.resource.nuke(...)` &mdash; same partial-match semantics, but spans every declaration:

```ts
actions.useAction(Actions.SignOut, async (context) => {
  await context.actions.dispatch(Actions.Auth.Cleared);
  context.actions.resource.nuke();
});
```

## Limitations

- **`.evict()` doesn't notify subscribers.** Evicting a slot drops the cached payload but does **not** fire any action. If components need to react, dispatch a broadcast as in the SSE pattern above.
- **SSE / WebSocket connections are component-scoped by default.** If multiple components want the same stream, hoist the connection to a Boundary-level component and broadcast events to subscribers via `Distribution.Broadcast`. Keep one EventSource per origin.
- **Reconnection logic is yours.** `EventSource` retries on its own; raw `WebSocket` doesn't. For WebSocket, wrap the listener in a reconnect loop driven by `Lifecycle.Unmount` cleanup signals.
