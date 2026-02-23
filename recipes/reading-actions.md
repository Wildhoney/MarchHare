# Reading and streaming broadcast values

There are two ways to access broadcast values:

1. **In handlers** &ndash; `context.actions.read(action)` returns `Promise<T | null>` for imperative reads inside action handlers.
2. **In JSX** &ndash; `actions.stream(action, renderer)` returns `React.ReactNode` for declarative rendering in component output.

## Handler-side read

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

## Peek (synchronous read)

Use `context.actions.peek` when you need the current cached value immediately without waiting for annotations to settle:

```ts
actions.useAction(Actions.Check, (context) => {
  const user = context.actions.peek(Actions.Broadcast.User);
  if (!user) return;
  console.log(user.name);
});
```

| Method | Returns              | Waits for settled | Use case                       |
| ------ | -------------------- | ----------------- | ------------------------------ |
| `read` | `Promise<T \| null>` | Yes               | Need the resolved value        |
| `peek` | `T \| null`          | No                | Quick guard check or sync read |

## Multicast support

For multicast actions, pass the scope name via the `options` argument:

```ts
const score = await context.actions.read(Actions.Multicast.Score, {
  scope: "game",
});
```

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

## JSX-side stream

Use `actions.stream` to render broadcast values declaratively in JSX. The renderer callback receives `(value, inspect)` and returns React nodes.

```tsx
function Dashboard() {
  const [model, actions] = useDashboardActions();

  return (
    <div>
      <h1>Dashboard</h1>
      {actions.stream(Actions.Broadcast.User, (user, inspect) => (
        <span>Welcome, {user.name}</span>
      ))}
    </div>
  );
}
```

### Key details

- Returns `null` until the first value is dispatched for that action
- Re-renders only the streamed portion when a new value arrives
- The `inspect` argument tracks annotation status (e.g. `inspect.pending()`)
- Payload type must be an object (`T extends object`) for annotation tracking

### When to use which

| Scenario                                   | Method                             |
| ------------------------------------------ | ---------------------------------- |
| Reading a broadcast value inside a handler | `context.actions.read(action)`     |
| Rendering a broadcast value in JSX output  | `actions.stream(action, renderer)` |
