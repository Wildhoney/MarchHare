# Mount and broadcast replay deduplication

When a component uses both `Lifecycle.Mount()` and a broadcast (or multicast) `useAction` handler, both fire during mount if a cached value exists. This can cause duplicate work &mdash; for example, fetching data twice.

## The problem

```ts
actions.useAction(Actions.Mount, async (context) => {
  // Always runs on mount
  const data = await fetchData(context.task.controller.signal);
  context.actions.produce(({ model }) => {
    model.data = data;
  });
});

actions.useAction(Actions.Broadcast.User, async (context, user) => {
  // Also runs on mount if a cached value exists
  const data = await fetchData(context.task.controller.signal, user.id);
  context.actions.produce(({ model }) => {
    model.data = data;
  });
});
```

If a broadcast value is already cached when the component mounts, **both** handlers fire &mdash; resulting in two fetches.

## Solution 1: `peek()` guard in Mount

Use `peek()` in the Mount handler to skip work when a cached broadcast value exists:

```ts
actions.useAction(Actions.Mount, (context) => {
  const user = context.actions.peek(Actions.Broadcast.User);
  if (user) return; // Broadcast handler will handle it
  fetchDefaultData(context.task.controller.signal);
});

actions.useAction(Actions.Broadcast.User, async (context, user) => {
  const data = await fetchData(context.task.controller.signal, user.id);
  context.actions.produce(({ model }) => {
    model.data = data;
  });
});
```

The Mount handler only fetches when no broadcast value is cached. When a cached value exists, only the broadcast handler runs.

## Solution 2: `context.phase` guard in broadcast handler

Skip the cached replay in the broadcast handler, letting Mount handle initial data:

```ts
actions.useAction(Actions.Mount, async (context) => {
  const data = await fetchDefaultData(context.task.controller.signal);
  context.actions.produce(({ model }) => {
    model.data = data;
  });
});

actions.useAction(Actions.Broadcast.User, (context, user) => {
  if (context.phase === Phase.Mounting) return; // Skip cached replay
  context.actions.produce(({ model }) => {
    model.data = user;
  });
});
```

During mount, `context.phase` is `Phase.Mounting`. Live dispatches after mount arrive with `Phase.Mounted`.

## Multicast support

Both patterns work identically with multicast actions. The action carries its own scope, so `peek()` takes it directly:

```ts
actions.useAction(Actions.Mount, (context) => {
  const user = context.actions.peek(Scope.User);
  if (user) return;
  fetchDefaultData(context.task.controller.signal);
});
```

## Which pattern to use

| Pattern        | Best when                                         |
| -------------- | ------------------------------------------------- |
| `peek()` guard | Mount fetches default data, broadcast overrides   |
| `phase` guard  | Mount always fetches, broadcast only handles live |
