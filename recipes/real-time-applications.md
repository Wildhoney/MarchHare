# Real-time applications

March Hare's lifecycle actions make it easy to integrate with real-time data sources like Server-Sent Events (SSE), WebSockets, or any event-based API. Use `Lifecycle.Mount()` to establish connections and `Lifecycle.Unmount()` to clean them up.

This recipe covers two patterns:

1. **Model-driven** &mdash; the simple case where incoming events update local model state.
2. **Cache-driven** &mdash; pushing incoming events into a Resource's cache so the rest of the app (other components, fetchers using `.exceeds({...})`) sees the fresh value without an extra round-trip.

## Pattern 1: model-driven (visitor stream)

Tracks website visitors in real-time using SSE:

```ts
import { useContext, Lifecycle, Action } from "march-hare";

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
  const context = useContext<Model, typeof Actions>();
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

## Pattern 2: cache-driven (SSE pushes into a Resource)

When a Resource is the canonical source of some data (e.g. a user profile fetched on demand) **and** a real-time controller can deliver updates for the same payload (server pushes a "user updated" event), use `context.actions.resource.set(...)` to write the incoming payload into the Resource's per-params cache slot. Subsequent reads via `resource.user({ id })` or refreshes via `.exceeds({...})` see the freshest value with the freshest timestamp &mdash; without a round-trip.

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
import { useContext, Lifecycle, Action, Distribution } from "march-hare";
import * as resource from "./resources";

class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();

  static Broadcast = {
    UserUpdated: Action<User>("UserUpdated", Distribution.Broadcast),
  };
}

type Model = {
  source: EventSource | null;
};

export function useActions() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions({ source: null });

  actions.useAction(Actions.Mount, (context) => {
    const source = new EventSource("/users/stream");
    source.addEventListener("user.updated", (event) => {
      const payload = JSON.parse(event.data) as User;
      context.actions.dispatch(Actions.Broadcast.UserUpdated, payload);
    });
    context.actions.produce(({ model }) => void (model.source = source));
  });

  actions.useAction(Actions.Broadcast.UserUpdated, (context, payload) => {
    // Push the SSE payload into the Resource's cache slot for these params.
    // - `resource.user({ id: payload.id })` now returns `payload`.
    // - `context.actions.resource(resource.user({ id: payload.id })).exceeds({ minutes: 5 })`
    //   short-circuits against the just-written timestamp.
    context.actions.resource.set(resource.user({ id: payload.id }), payload);
  });

  actions.useAction(Actions.Unmount, (context) => {
    context.model.source?.close();
  });

  return actions;
}
```

Why route through a broadcast action rather than calling `resource.set(...)` directly inside the SSE listener?

- **One subscriber per SSE event.** The broadcast lets multiple components listen for `UserUpdated` (e.g. a profile screen wants to update its local model, a header avatar wants to re-render) while the Resource cache itself gets one canonical write.
- **Cancellation.** The action handler's signal is auto-threaded into the `.resource.set` write &mdash; if the component unmounts mid-event, the handler short-circuits naturally.
- **Replay.** Late-mounting components automatically receive the cached broadcast value via `useAction(Actions.Broadcast.UserUpdated, ...)` &mdash; the SSE stream doesn't need to replay.

For resources without params, call the resource with no args:

```ts
context.actions.resource.set(resource.banner(), payload);
```

For overwriting a payload that's already cached, the write replaces it &mdash; `at` always advances to `Temporal.Now.instant()` so freshness windows reset.

## Pattern 3: WebSocket with optimistic correlation

When the WebSocket carries both server-driven updates _and_ echoes of the client's own writes, key the cache slot on the same params the fetcher uses and let `.set` deduplicate:

```ts
socket.addEventListener("message", (event) => {
  const { type, payload } = JSON.parse(event.data);
  if (type === "user.updated") {
    context.actions.dispatch(Actions.Broadcast.UserUpdated, payload);
  }
});

actions.useAction(Actions.Rename, async (context, name) => {
  // Optimistic write into the cache.
  const previous = resource.user({ id: context.data.userId });
  context.actions.resource.set(resource.user({ id: context.data.userId }), {
    ...previous!,
    name,
  });

  try {
    // Server confirms; the WS event will arrive and rewrite the cache anyway.
    await context.actions.resource(
      resource.updateUser({ id: context.data.userId, name }),
    );
  } catch (error) {
    // Roll back.
    if (previous) {
      context.actions.resource.set(
        resource.user({ id: context.data.userId }),
        previous,
      );
    }
    throw error;
  }
});
```

## Limitations

- **Cache-driven writes don't notify subscribers.** `resource.set(...)` updates the slot but does **not** fire any action. If components need to react, dispatch a broadcast as in the SSE pattern above. (`resource.user({ id })` is not reactive on its own &mdash; it's a snapshot, not a signal.)
- **SSE / WebSocket connections are component-scoped by default.** If multiple components want the same stream, hoist the connection to a Boundary-level component and broadcast events to subscribers via `Distribution.Broadcast`. Keep one EventSource per origin.
- **Reconnection logic is yours.** `EventSource` retries on its own; raw `WebSocket` doesn't. For WebSocket, wrap the listener in a reconnect loop driven by `Lifecycle.Unmount` cleanup signals.
