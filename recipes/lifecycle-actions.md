# Lifecycle actions

Chizu provides lifecycle actions that trigger at specific points in a component's lifecycle. Import `Lifecycle` from Chizu and bind handlers using `actions.useAction`:

```ts
import { useActions, Lifecycle } from "chizu";

export function useMyActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Lifecycle.Mount, (context) => {
    // Setup logic when component mounts
  });

  actions.useAction(Lifecycle.Unmount, (context) => {
    // Cleanup logic when component unmounts
  });

  actions.useAction(Lifecycle.Error, (context, error) => {
    // Handle errors from other actions
  });

  return actions;
}
```

- **`Lifecycle.Mount`** &ndash; Triggered once when the component mounts (`useLayoutEffect`).
- **`Lifecycle.Node`** &ndash; Triggered after the component renders (`useEffect`).
- **`Lifecycle.Error`** &ndash; Triggered when an action throws an error. Receives `ErrorDetails` as payload.
- **`Lifecycle.Unmount`** &ndash; Triggered when the component unmounts. All in-flight actions are automatically aborted before this handler runs.

**Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. `Lifecycle.Error` handles errors **locally** where they occurred, allowing component-specific error recovery or UI updates.
