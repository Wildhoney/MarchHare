# Mount and broadcast replay deduplication

When a component uses both `Lifecycle.Mount()` and a broadcast (or multicast) `useAction` handler, both fire during mount if a cached value already exists. Without coordination, you get two fetches for the same data and a "last write wins" race for the model field.

## The fix: share the in-flight promise via `.coalesce()`

Chain `.coalesce(token?)` onto the `context.actions.resource(...)` call. While one fetch for the same `(Resource, params, token)` triple is in-flight, every other caller receives the same promise. Mount and the replayed broadcast handler can both fire freely; the second caller transparently joins the first call's request.

The token is optional. If you simply want every caller of this Resource + params to share, call `.coalesce()` with no argument &mdash; every untokened caller for the same `(Resource, params)` slot collapses onto a single shared promise:

```ts
actions.useAction(Actions.Mount, async (context) => {
  const dashboard = await context.actions
    .resource(resource.dashboard())
    .coalesce();
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});

actions.useAction(Actions.Broadcast.User, async (context, payload) => {
  const dashboard = await context.actions
    .resource(resource.dashboard({ userId: payload.id }))
    .coalesce();
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});
```

Reach for the tokened form when you have multiple coalesce groups for the same Resource &mdash; for example, an initial-load group and a separate refresh group that mustn't share with the initial load. Define the token as an enum value &mdash; not a magic string &mdash; so call sites are typed and greppable:

```ts
// resources.ts
import { app } from "./app";

export const dashboard = app.Resource<Dashboard, { userId?: number }>(
  (context) =>
    ky
      .get("/api/dashboard", {
        searchParams: context.params.userId
          ? { userId: context.params.userId }
          : {},
        signal: context.controller.signal,
      })
      .json<Dashboard>(),
);
```

```ts
// dashboard/actions.ts
import { Action, Lifecycle } from "march-hare";
import { app } from "../app";
import * as resource from "../resources";

type Model = { dashboard: Dashboard | null };

export class Actions {
  static Mount = Lifecycle.Mount();
  static Broadcast = BroadcastActions;
}

enum Coalesce {
  Dashboard,
  Refresh,
}

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ dashboard: null });

  actions.useAction(Actions.Mount, async (context) => {
    const dashboard = await context.actions
      .resource(resource.dashboard())
      .coalesce(Coalesce.Dashboard);
    context.actions.produce(({ model }) => void (model.dashboard = dashboard));
  });

  actions.useAction(Actions.Broadcast.User, async (context, payload) => {
    const dashboard = await context.actions
      .resource(resource.dashboard({ userId: payload.id }))
      .coalesce(Coalesce.Dashboard);
    context.actions.produce(({ model }) => void (model.dashboard = dashboard));
  });

  return actions;
}
```

On mount with a cached `Broadcast.User` value both handlers fire, both call `.resource(dashboard(...)).coalesce(Coalesce.Dashboard)`, and exactly one HTTP request goes out for any given params slot. The shared fetch uses a detached `AbortController`, so the component unmounting (or one handler being superseded) does not cancel the work the other handler is still awaiting. Each caller's own `context.task.controller` still aborts their personal await on demand.

The dedupe key is the triple `(Resource, params, token)`:

- Two calls to `resource.dashboard({ userId: 7 }).coalesce(Coalesce.Dashboard)` share.
- `resource.dashboard({ userId: 7 }).coalesce(Coalesce.Dashboard)` and `resource.dashboard({ userId: 8 }).coalesce(Coalesce.Dashboard)` do **not** share &mdash; different params, different fetches.
- `resource.dashboard({ userId: 7 }).coalesce(Coalesce.Dashboard)` and `resource.dashboard({ userId: 7 }).coalesce(Coalesce.Refresh)` do **not** share &mdash; different tokens, different fetches.
- `resource.cat().coalesce(Coalesce.Dashboard)` and `resource.dashboard().coalesce(Coalesce.Dashboard)` do **not** share &mdash; same token but different Resources. Identity comes from the fetcher closure, not the token.

The token namespace is scoped to the enclosing `<app.Boundary>`, so `Coalesce.Dashboard` in one App is independent of the same value in a sibling App's tree.

## Multicast

Multicast actions work identically &mdash; the dedupe key is unchanged, and the `Scope.X` action carries its own scope so coalescing across handlers in the same multicast region just works:

```ts
actions.useAction(Scope.User, async (context, payload) => {
  const dashboard = await context.actions
    .resource(resource.dashboard({ userId: payload.id }))
    .coalesce(Coalesce.Dashboard);
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});
```
