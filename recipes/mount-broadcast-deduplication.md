# Mount and broadcast replay deduplication

When a component uses both `Lifecycle.Mount()` and a broadcast (or multicast) `useAction` handler, both fire during mount if a cached value already exists. Without coordination this would mean two fetches for the same data and a "last write wins" race for the model field.

March Hare resolves this automatically: concurrent `context.actions.resource(...)` callers with the same `(Resource, params)` share a single in-flight fetch by default. Mount and the replayed broadcast handler can both fire freely; the second caller transparently joins the first call's request, and both resolutions land with the same payload.

## The default: one fetch, two resolutions

```ts
actions.useAction(Actions.Mount, async (context) => {
  const dashboard = await context.actions.resource(resource.dashboard());
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});

actions.useAction(Actions.Broadcast.User, async (context, payload) => {
  const dashboard = await context.actions.resource(
    resource.dashboard({ userId: payload.id }),
  );
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});
```

No `.coalesce()` chain, no opt-in. The runtime keys the dedupe map by `(Resource.run, JSON.stringify(params))`, so:

- Two calls to `resource.dashboard({ userId: 7 })` share &mdash; one network request, both handlers receive the same payload.
- `resource.dashboard({ userId: 7 })` and `resource.dashboard({ userId: 8 })` do **not** share &mdash; different params, different slots, two requests.
- `resource.cat()` and `resource.dashboard()` do **not** share &mdash; different Resources, identified by the underlying fetcher closure.

The shared fetch runs on a detached `AbortController`. One caller's `context.task.controller` aborting only severs that caller's await &mdash; the underlying work keeps going for everyone else. When every caller has aborted, the shared controller is aborted too, so the network gets cancelled rather than orphaned.

## Multicast

Multicast actions work identically &mdash; the dedupe key is the same `(Resource, params)` tuple, and a `Scope.X` action carries its own scope so two handlers in the same multicast region share a fetch automatically:

```ts
actions.useAction(Scope.User, async (context, payload) => {
  const dashboard = await context.actions.resource(
    resource.dashboard({ userId: payload.id }),
  );
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});
```

## When parallel requests are genuinely required

The only case the default doesn't cover: two callers that intentionally want **independent** fetches with byte-identical params. This is rare. Almost every "looks like I want two of the same call" scenario is better modelled by giving the two calls distinguishing params (a discriminator, a timestamp, a nonce) so the dedupe key splits them naturally.

For the residual case, chain `.isolated()`:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  const fresh = await context.actions.resource(resource.dashboard()).isolated();
  context.actions.produce(({ model }) => void (model.dashboard = fresh));
});
```

`.isolated()` skips the registry entirely &mdash; the fetch fires as a fresh network request against the caller's own `context.task.controller`, so aborting the caller cancels the network exactly like a regular `fetch`. Use it sparingly; the default is the right answer for virtually every read.
