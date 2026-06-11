# Error handling

March Hare publishes every action failure as `Lifecycle.Fault`, a singleton broadcast action delivered through the surrounding `<Boundary>`. Subscribe to it like any other action to handle errors centrally:

```tsx
import { Lifecycle, Reason } from "march-hare";
import { app } from "./app";

function App() {
  const context = app.useContext();
  const actions = context.useActions();

  actions.useAction(Lifecycle.Fault, (_context, { reason, error, action }) => {
    switch (reason) {
      case Reason.Aborted:
        console.info(`Action "${action}" was aborted`);
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

- **`reason`** &ndash; Either `Reason.Aborted` or `Reason.Errored`.

- **`error`** &ndash; The `Error` object that was thrown.
- **`action`** &ndash; The name of the action that caused the error.
- **`handled`** &ndash; Whether the failing component has a `Lifecycle.Error()` handler registered.
- **`tasks`** &ndash; All currently running tasks across the application, enabling programmatic abort during error recovery.
- **`retry`** &ndash; A `() => Promise<void>` that re-dispatches the failed action with the original payload and channel, routed through the same emitter as the original dispatch. Suitable for binding directly to a "Retry" button in a UI.

## Error reasons

| Reason           | Description                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Reason.Aborted` | Action was cancelled &mdash; superseded by a newer dispatch, the component unmounted, or `context.task.controller.abort()` (or fetch) fired |
| `Reason.Errored` | Action threw an uncaught error                                                                                                              |

## Local vs global error handling

`Lifecycle.Fault` is the global catch-all for errors from **any** action in the boundary &ndash; useful for app-level reporting, sign-out on auth failure, or abort cascades. For component-specific recovery, use the per-component `Lifecycle.Error()` factory instead (see [lifecycle-actions.md](./lifecycle-actions.md)):

```ts
class Actions {
  static Error = Lifecycle.Error();
}

actions.useAction(Actions.Error, (context, fault) => {
  context.actions.produce(
    ({ model }) => void (model.errorMessage = fault.error.message),
  );
});
```

The `handled` field on the global fault payload tells you whether the failing component had a local `Lifecycle.Error()` handler registered, so app-level reporters can avoid double-handling errors that have already been recovered locally.

> **Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. Fault handlers are intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

## Retrying a failed action

Every `Fault` carries a `retry` callback that re-dispatches the failing action with the original payload and channel. It uses the same routing as a fresh dispatch &mdash; broadcast/multicast/unicast selection is preserved &mdash; and runs against a fresh `AbortController`, so it works even when the original failure was `Reason.Aborted`.

```ts
actions.useAction(Lifecycle.Fault, (_context, fault) => {
  if (fault.reason === Reason.Errored && isTransient(fault.error)) {
    void fault.retry();
  }
});
```

`retry` is just a function reference, so it can also be surfaced to the view layer &ndash; e.g. stashed on the model and bound directly to a "Retry" button in the UI.

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
