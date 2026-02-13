# Reading broadcast values in handlers

Use `context.actions.read` to read the latest broadcast or multicast value directly inside an action handler, without subscribing via `useAction` and storing it in the local model.

```ts
actions.useAction(Actions.FetchPosts, async (context) => {
  const user = await context.actions.read(Actions.Broadcast.User);
  if (!user) return;
  const posts = await fetchPosts(user.id, {
    signal: context.task.controller.signal,
  });
  context.actions.produce(({ model }) => {
    model.posts = posts;
  });
});
```

> **Important:** The `read()` method only accepts broadcast or multicast actions. Attempting to pass a unicast action returns `null` as unicast values are not cached.

## Key details

- **Async** &ndash; returns `Promise<T | null>`. If the corresponding model field has pending Immertation annotations, `read` waits for them to settle before resolving.
- **Raw value** &ndash; returns `T`, not a `Box<T>`. Handlers need the data, not the reactive wrapper.
- **Null when empty** &ndash; returns `null` if no value has been dispatched for that action.
- **Abort-safe** &ndash; returns `null` if the task's abort signal has fired.
- **Reads from cache** &ndash; values are stored by the `BroadcastEmitter` automatically when dispatched.

## Multicast support

For multicast actions, pass the scope name via the `options` argument:

```ts
const score = await context.actions.read(Actions.Multicast.Score, {
  scope: "game",
});
```

## Reactive subscriptions with derive

For reactive model values from broadcast or multicast actions, use `derive` instead of `read`. The `derive` method subscribes to actions and maps their payloads onto the model:

```tsx
const result = useMyActions();

const [model] = result
  .derive("user", Actions.Broadcast.User, (user) => user)
  .derive("score", Actions.Multicast.Score, (score) => score);

// model.user is null until first dispatch, then stays in sync
```

See the [derived values recipe](./derived-values.md) for more details.

## Cached values for useAction handlers

Components using `useAction()` for broadcast actions also receive cached values on mount. When a component mounts with a handler for a broadcast action, the handler is automatically invoked with the most recent value from the broadcast cache.

```tsx
// Component A dispatches a broadcast action
function ComponentA() {
  const [, actions] = useActions<Model, typeof Actions>(model);

  return (
    <button onClick={() => actions.dispatch(Actions.Counter, 42)}>
      Update Counter
    </button>
  );
}

// Component B mounts later and receives the cached value
function ComponentB() {
  const actions = useActions<Model, typeof Actions>(model);

  // This handler is invoked with 42 when the component mounts
  // (assuming ComponentA dispatched before ComponentB mounted)
  actions.useAction(Actions.Counter, (context, value) => {
    console.log("Received cached value:", value);
  });

  return <div>Late Component</div>;
}
```

This enables late-mounting components to synchronise with previously dispatched state. See the [broadcast actions recipe](./broadcast-actions.md#cached-values-on-mount) for more details.
