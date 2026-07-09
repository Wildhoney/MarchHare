# Broadcast invalidation

When a domain event occurs (e.g. user signs out, permissions change, locale switches), multiple producers may need to re-fetch and re-broadcast their data. Coordinate that without coupling producers to each other.

## The problem

Two features each fetch on mount and broadcast their result. Both flow through `app.Resource`:

```ts
// resources.ts
import { app } from "./app";

export const user = app.Resource<User, { id: number }>((context) =>
  ky
    .get(`/api/users/${context.params.id}`, {
      signal: context.controller.signal,
    })
    .json<User>(),
);

export const settings = app.Resource<Settings>((context) =>
  ky
    .get("/api/settings", { signal: context.controller.signal })
    .json<Settings>(),
);
```

```ts
// user/actions.ts
import * as resource from "../resources";

function useActions(props: { userId: number }) {
  const context = app.useContext<Model, typeof Actions, { userId: number }>();
  const actions = context.useActions(model, () => ({ userId: props.userId }));

  actions.useAction(Actions.Mount, async (context) => {
    const user = await context.actions.resource(
      resource.user({ id: context.data.userId }),
    );
    context.actions.dispatch(Actions.Broadcast.User, user);
  });

  return actions;
}
```

```ts
// settings/actions.ts
import * as resource from "../resources";

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Mount, async (context) => {
    const settings = await context.actions.resource(resource.settings());
    context.actions.dispatch(Actions.Broadcast.Settings, settings);
  });

  return actions;
}
```

When the user signs out, both need to re-fetch. But `Actions.Broadcast.User` takes a `userId` and `Actions.Broadcast.Settings` takes no arguments &mdash; you cannot simply "replay" them.

## Solution: shared reset action

Add a `Reset` action to the shared broadcast class. Each producer subscribes to it and re-fetches via its own `resource(...)` call:

```ts
// shared/types.ts
import { Action, Distribution } from "march-hare";

export class BroadcastActions {
  static Reset = Action("Reset", Distribution.Broadcast);
  static User = Action<User>("User", Distribution.Broadcast);
  static Settings = Action<Settings>("Settings", Distribution.Broadcast);
}
```

Each producer's `useActions` listens for both Mount and Reset and routes through the same `resource()` fetch:

```ts
// user/actions.ts
import { Lifecycle } from "march-hare";
import { app } from "../app";
import * as resource from "../resources";

export class Actions {
  static Mount = Lifecycle.Mount();
  static Broadcast = BroadcastActions;
}

function useActions(props: { userId: number }) {
  const context = app.useContext<Model, typeof Actions, { userId: number }>();
  const actions = context.useActions(model, () => ({ userId: props.userId }));

  const fetchUser = async (context: HandlerContext) => {
    const user = await context.actions.resource(
      resource.user({ id: context.data.userId }),
    );
    context.actions.dispatch(Actions.Broadcast.User, user);
  };

  actions.useAction(Actions.Mount, fetchUser);
  actions.useAction(Actions.Broadcast.Reset, fetchUser);

  return actions;
}
```

```ts
// settings/actions.ts
import { Lifecycle } from "march-hare";
import { app } from "../app";
import * as resource from "../resources";

export class Actions {
  static Mount = Lifecycle.Mount();
  static Broadcast = BroadcastActions;
}

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  const fetchSettings = async (context: HandlerContext) => {
    const settings = await context.actions.resource(resource.settings());
    context.actions.dispatch(Actions.Broadcast.Settings, settings);
  };

  actions.useAction(Actions.Mount, fetchSettings);
  actions.useAction(Actions.Broadcast.Reset, fetchSettings);

  return actions;
}
```

Any component can trigger the reset:

```ts
actions.dispatch(Actions.Broadcast.Reset);
```

Each producer re-fetches via its own `resource(...)` invocation. The reset action carries no payload &mdash; it is purely a signal. Because the fetch goes through `app.Resource`, every cache, abort, default coalesce-by-`(Resource, params)`, and `.exceeds(...)` / `.isolated()` semantic is preserved.

## Typed reset payloads

When different reset scenarios require different behaviour, give the reset action a payload:

```ts
type ResetScope = "auth" | "preferences" | "all";

export class BroadcastActions {
  static Reset = Action<ResetScope>("Reset", Distribution.Broadcast);
  static User = Action<User>("User", Distribution.Broadcast);
  static Settings = Action<Settings>("Settings", Distribution.Broadcast);
}

// Only re-fetch when auth or all resets are triggered.
actions.useAction(Actions.Broadcast.Reset, async (context, scope) => {
  if (scope !== "auth" && scope !== "all") return;
  const user = await context.actions.resource(
    resource.user({ id: context.data.userId }),
  );
  context.actions.dispatch(Actions.Broadcast.User, user);
});
```

## When to prefer `.evict()` / `.nuke()`

The reset-then-refetch pattern above keeps the producer in control: each subscriber decides _whether_ to refetch, _what_ params to use, and _how_ to dispatch the resulting broadcast. Use it when:

- Different producers need different reset scopes
- The reset needs to fan out to UI updates beyond cache flushing (skeleton states, scroll resets, etc.)
- You want typed payloads on the reset event

Reach for `context.actions.resource(...).evict(where?)` or `context.actions.resource.nuke(where?)` when you just need to drop cache entries without coordinating refetches &mdash; e.g. on sign-out where the next mount will fetch fresh anyway. Eviction still fans out via each Resource's `.action(evictedParams)` broadcast with a `null` payload, so subscribers to `resource.x.action(...)` see the drop in-line with the fetch stream (the payload type is `T | null`). See [`use-resource.md`](./use-resource.md#invalidation--evict-and-nuke).

## Comparison with React Query

| React Query                      | March Hare                                     |
| -------------------------------- | ---------------------------------------------- |
| `queryClient.invalidateQueries`  | Dispatch a shared broadcast reset action       |
| Automatic re-fetch on invalidate | Producer handles re-fetch in its reset handler |
| Tag-based invalidation           | Typed payload on the reset action              |
| Global query client              | Scoped to `<app.Boundary>`                     |

The key difference: React Query owns the fetch function and can re-run it. In March Hare, the producer owns the fetch logic but routes through `app.Resource`, so invalidation is a signal that tells producers to re-run themselves &mdash; with all the caching, cancellation, and coalescing benefits the Resource layer provides.
