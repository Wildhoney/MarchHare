# Error handling

Chizu publishes every action failure as `Lifecycle.Fault`, a singleton broadcast action delivered through the surrounding `<Boundary>`. Subscribe to it like any other action to handle errors centrally:

```tsx
import { useActions, Lifecycle, Reason } from "chizu";

function App() {
  const actions = useActions();

  actions.useAction(Lifecycle.Fault, (_context, { reason, error, action }) => {
    switch (reason) {
      case Reason.Timedout:
        console.warn(`Action "${action}" timed out:`, error.message);
        break;
      case Reason.Supplanted:
        console.info(`Action "${action}" was supplanted`);
        break;
      case Reason.Errored:
        console.error(`Action "${action}" failed:`, error.message);
        break;
    }
  });

  return <Profile />;
}
```

The `Fault` payload contains:

- **`reason`** &ndash; One of `Reason.Timedout`, `Reason.Supplanted`, or `Reason.Errored`.
- **`error`** &ndash; The `Error` object that was thrown.
- **`action`** &ndash; The name of the action that caused the error.
- **`handled`** &ndash; Whether the failing component has a `Lifecycle.Error()` handler registered.
- **`tasks`** &ndash; All currently running tasks across the application, enabling programmatic abort during error recovery.

## Error reasons

| Reason              | Description                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| `Reason.Timedout`   | Action exceeded the configured timeout duration                                 |
| `Reason.Supplanted` | Action was cancelled because a newer instance of the same action was dispatched |
| `Reason.Errored`    | Action threw an uncaught error                                                  |

## Local vs global error handling

`Lifecycle.Fault` is the global catch-all for errors from **any** action in the boundary &ndash; useful for app-level reporting, sign-out on auth failure, or abort cascades. For component-specific recovery, use the per-component `Lifecycle.Error()` factory instead (see [lifecycle-actions.md](./lifecycle-actions.md)):

```ts
class Actions {
  static Error = Lifecycle.Error();
}

actions.useAction(Actions.Error, (context, fault) => {
  context.actions.produce(({ model }) => {
    model.errorMessage = fault.error.message;
  });
});
```

The `handled` field on the global fault payload tells you whether the failing component had a local `Lifecycle.Error()` handler registered, so app-level reporters can avoid double-handling errors that have already been recovered locally.

> **Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. Fault handlers are intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

## Aborting tasks during error recovery

When handling authentication errors (e.g., 401/403), you may want to abort all in-flight tasks to prevent cascading failures. The `tasks` property on the `Fault` enables this:

```ts
actions.useAction(Lifecycle.Fault, (_context, { reason, error, tasks }) => {
  if (reason === Reason.Errored && isAuthError(error)) {
    for (const task of tasks) task.controller.abort();
    redirectToLogin();
  }
});
```

This is particularly useful for session expiration scenarios where multiple API calls might be in progress when authentication fails.
