# Referential equality

Chizu uses a ref-based pattern internally, so action handlers in `actions.useAction` always access the latest values from closures without needing to re-create the handler. This means you don't need to worry about stale closures in most cases.

However, in async actions where you `await` I/O operations, there's a rare edge case: if a closure reference changes while the await is in progress, you may access a stale value after the await. For these situations, pass a data callback to `useActions`:

```ts
import { useActions } from "chizu";

type Data = { filters: string[] };

function useSearchActions(props: Props) {
  const actions = useActions<Model, typeof Actions, Data>(model, () => ({
    filters: props.filters,
  }));

  actions.useAction(Actions.Search, async (context, query) => {
    // Before await: props.filters is current
    console.log(props.filters);

    const results = await fetch(`/search?q=${query}`);

    // After await: props.filters might be stale if it changed during the fetch
    // Use context.data.filters instead for guaranteed latest value
    console.log(context.data.filters);
  });

  return actions;
}
```

The data callback creates a proxy object where property access always returns the latest value from a ref that updates on every render. Use `context.data` when you need to access props or external values (like `useState` from parent components) after an await in async actions.
