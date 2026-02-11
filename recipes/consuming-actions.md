# Consuming actions

The `consume()` method subscribes to a broadcast action and re-renders content whenever a new value is dispatched, making it ideal for global context scenarios where you want to fetch data once and access it throughout your app without prop drilling. The callback receives a `Box<T>` from [Immertation](https://github.com/Wildhoney/Immertation) containing the `value` and an `inspect` proxy for checking annotation status.

```tsx
export default function Visitor(): React.ReactElement {
  const [model, actions] = useVisitorActions();

  return (
    <div>
      {actions.consume(Actions.Visitor, (visitor) =>
        visitor.inspect.pending() ? <>Loading&hellip;</> : visitor.value.name,
      )}
    </div>
  );
}
```

> **Important:** The `consume()` method only accepts broadcast actions created with `Distribution.Broadcast`. Attempting to pass a local (unicast) action will result in a TypeScript error. This is enforced at compile-time to prevent confusion &ndash; local actions are scoped to a single component and cannot be consumed across the application.

> **Note:** When a component mounts, `consume()` displays the most recent value for that action, even if it was dispatched before the component mounted. This is managed by the `Consumer` context provider. If no value has been dispatched yet, `consume()` renders `null` until the first dispatch occurs.

## Cached values for useAction handlers

Components using `useAction()` for broadcast actions also receive cached values on mount. When a component mounts with a handler for a broadcast action, the handler is automatically invoked with the most recent value that was stored by any `consume()` call.

```tsx
// This component stores dispatched values in the cache
function ConsumerComponent() {
  const [model, actions] = useActions<Model, typeof Actions>(model);
  return <>{actions.consume(Actions.Name, (box) => box.value)}</>;
}

// This component's handler receives cached values on mount
function LateComponent() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Name, (context, name) => {
    // Called with the cached value when component mounts
    console.log("Received:", name);
  });

  return <div>Late Component</div>;
}
```

This enables late-mounting components to synchronise with previously dispatched state. See the [broadcast actions recipe](./broadcast-actions.md#cached-values-on-mount) for more details.

## Handler-side consume

Use `context.actions.consume` to read the latest broadcast or multicast value directly inside an action handler, without subscribing via `useAction` and storing it in the local model.

```ts
actions.useAction(Actions.FetchPosts, async (context) => {
  const user = await context.actions.consume(Actions.Broadcast.User);
  if (!user) return;
  const posts = await fetchPosts(user.id, {
    signal: context.task.controller.signal,
  });
  context.actions.produce(({ model }) => {
    model.posts = posts;
  });
});
```

Key details:

- **Async** &ndash; returns `Promise<T | null>`.
- **Raw value** &ndash; returns `T`, not a `Box<T>`. Handlers need the data, not the reactive wrapper.
- **Null when empty** &ndash; returns `null` if no value has been dispatched for that action.
- **Awaits settled** &ndash; if the value has pending annotations, `consume` waits for `settled()` before returning.
- **Abort-safe** &ndash; respects `context.task.controller.signal`. Returns `null` if the task is aborted while waiting.
- **Requires a store entry** &ndash; a JSX-side `consume()` or `<Partition>` must have populated the consumer store for the value to be available.

### Multicast support

For multicast actions, pass the scope name via the `options` argument:

```ts
const score = await context.actions.consume(Actions.Multicast.Score, {
  scope: "game",
});
```
