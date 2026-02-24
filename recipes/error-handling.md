# Error handling

Chizu provides a centralised way to catch errors that occur within your actions. Use the `Error` component to wrap your application and provide a global error handler:

```tsx
import { Error, Reason } from "chizu";

function App(): ReactElement {
  return (
    <Error
      handler={({ reason, error, action }) => {
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
      }}
    >
      <Profile />
    </Error>
  );
}
```

The `Fault` object passed to the handler contains:

- **`reason`** &ndash; One of `Reason.Timedout`, `Reason.Supplanted`, `Reason.Disallowed`, or `Reason.Errored`.
- **`error`** &ndash; The `Error` object that was thrown.
- **`action`** &ndash; The name of the action that caused the error.
- **`handled`** &ndash; Whether the component has a `Lifecycle.Error()` handler registered.
- **`tasks`** &ndash; All currently running tasks across the application, enabling programmatic abort during error recovery.

## Error reasons

| Reason              | Description                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| `Reason.Timedout`   | Action exceeded the configured timeout duration                                      |
| `Reason.Supplanted` | Action was cancelled because a newer instance of the same action was dispatched      |
| `Reason.Disallowed` | Action was blocked by a regulator (see [action-regulator.md](./action-regulator.md)) |
| `Reason.Errored`    | Action threw an uncaught error                                                       |

## Local vs global error handling

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. For component-specific error recovery, use `Lifecycle.Error()` instead (see [lifecycle-actions.md](./lifecycle-actions.md)):

```ts
class Actions {
  static Error = Lifecycle.Error();
}

actions.useAction(Actions.Error, (context, error) => {
  // Handle errors locally where they occurred
  context.actions.produce((draft) => {
    draft.model.errorMessage = error.message;
  });
});
```

> **Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. Error handlers are intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

## Aborting tasks during error recovery

When handling authentication errors (e.g., 401/403), you may want to abort all in-flight tasks to prevent cascading failures. The `tasks` property on the `Fault` object enables this:

```tsx
<Error
  handler={({ reason, error, tasks }) => {
    if (reason === Reason.Errored && isAuthError(error)) {
      // Abort all in-flight tasks to prevent further errors
      for (const task of tasks) {
        task.controller.abort();
      }
      // Trigger re-authentication
      redirectToLogin();
    }
  }}
>
  <App />
</Error>
```

This is particularly useful for session expiration scenarios where multiple API calls might be in progress when authentication fails.
