# Referential equality

Chizu uses [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) internally, so action handlers in `actions.useAction` always access the latest values from closures without needing to re-create the handler. This means you don't need to worry about stale closures in most cases.

However, in async actions where you `await` I/O operations, there's a rare edge case: if a closure reference changes while the await is in progress, you may access a stale value after the await. For these situations, use `useSnapshot`:

```ts
import { useActions, useSnapshot } from "chizu";

function useSearchActions(props: Props) {
  const actions = useActions<Model, typeof Actions>(model);
  const snapshot = useSnapshot(props);

  actions.useAction(Actions.Search, async (context, query) => {
    // Before await: props.filters is current (useEffectEvent-like behavior)
    console.log(props.filters);

    const results = await fetch(`/search?q=${query}`);

    // After await: props.filters might be stale if it changed during the fetch
    // Use snapshot.filters instead for guaranteed latest value
    console.log(snapshot.filters);
  });

  return actions;
}
```

`useSnapshot` creates a proxy object where property access always returns the latest value from a ref that updates on every render. Use it when you need to access props or external values after an await in async actions.
