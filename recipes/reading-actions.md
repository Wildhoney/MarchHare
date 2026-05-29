# Reading and streaming broadcast values

There are two ways to access broadcast values:

1. **In handlers** &ndash; `context.actions.resolution(action)` returns `Promise<T | null>`, waiting for annotations to settle.
2. **In JSX** &ndash; `actions.stream(action, renderer)` returns `React.ReactNode` for declarative rendering in component output.

## Handler-side resolution

Use `context.actions.resolution` to get the latest broadcast or multicast value inside an action handler, waiting for any pending annotations to settle before resolving.

```ts
actions.useAction(Actions.FetchPosts, async (context) => {
  const user = await context.actions.resolution(Actions.Broadcast.User);
  if (!user) return;
  const posts = await fetchPosts(user.id, {
    signal: context.task.controller.signal,
  });
  context.actions.produce(({ model }) => void (model.posts = posts));
});
```

> **Important:** `resolution()` only accepts broadcast or multicast actions. Attempting to pass a unicast action returns `null` as unicast values are not cached.

## Key details

- **Async** &ndash; returns `Promise<T | null>`. If the corresponding model field has pending Immertation annotations, `resolution` waits for them to settle before resolving.
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

| Method       | Returns              | Waits for settled | Use case                       |
| ------------ | -------------------- | ----------------- | ------------------------------ |
| `resolution` | `Promise<T \| null>` | Yes               | Need the resolved value        |
| `peek`       | `T \| null`          | No                | Quick guard check or sync read |

## Multicast support

Multicast actions read their scope from the action itself, so `resolution` and `peek` accept them with no extra arguments:

```ts
const score = await context.actions.resolution(Scope.Score);
```

## Cached values for useAction handlers

Components using `useAction()` for broadcast actions also receive cached values on mount. When a component mounts with a handler for a broadcast action, the handler is automatically invoked with the most recent value from the broadcast cache.

```tsx
// Component A dispatches a broadcast action
function ComponentA() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  return (
    <button onClick={() => actions.dispatch(Actions.Counter, 42)}>
      Update Counter
    </button>
  );
}

// Component B mounts later and receives the cached value
function ComponentB() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

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

| Scenario                                   | Method                               |
| ------------------------------------------ | ------------------------------------ |
| Reading a broadcast value inside a handler | `context.actions.resolution(action)` |
| Rendering a broadcast value in JSX output  | `actions.stream(action, renderer)`   |
