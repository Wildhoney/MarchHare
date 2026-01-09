# Consuming actions

The `consume()` method subscribes to a distributed action and re-renders content whenever a new value is dispatched, making it ideal for global context scenarios where you want to fetch data once and access it throughout your app without prop drilling. The callback receives a `Box<T>` from [Immertation](https://github.com/Wildhoney/Immertation) containing the `value` and an `inspect` proxy for checking annotation status.

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

> **Important:** The `consume()` method only accepts distributed actions created with `Distribution.Broadcast`. Attempting to pass a local (unicast) action will result in a TypeScript error. This is enforced at compile-time to prevent confusion &ndash; local actions are scoped to a single component and cannot be consumed across the application.

> **Note:** When a component mounts, `consume()` displays the most recent value for that action, even if it was dispatched before the component mounted. This is managed by the `Consumer` context provider. If no value has been dispatched yet, `consume()` renders `null` until the first dispatch occurs.
