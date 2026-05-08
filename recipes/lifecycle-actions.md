# Lifecycle actions

Chizu provides lifecycle actions that trigger at specific points in a component's lifecycle. Lifecycle actions are **factory functions** — each call to `Lifecycle.Mount()` returns a unique action symbol, enabling per-component regulation.

Assign lifecycle factories as static properties in your Actions class:

```ts
import { useActions, Lifecycle, Action } from "chizu";

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Error = Lifecycle.Error();
  static Update = Lifecycle.Update();

  static Increment = Action("Increment");
}

export function useMyActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Mount, (context) => {
    // Setup logic when component mounts
  });

  actions.useAction(Actions.Unmount, (context) => {
    // Cleanup logic when component unmounts
  });

  actions.useAction(Actions.Error, (context, error) => {
    // Handle errors from other actions
  });

  return actions;
}
```

- **`Lifecycle.Mount()`** &ndash; Triggered once when the component mounts (`useLayoutEffect`). Protected against React Strict Mode double-invocation.
- **`Lifecycle.Error()`** &ndash; Triggered when an action **in this component** throws. Receives `Fault` as payload. Each call returns a unique per-component symbol.
- **`Lifecycle.Unmount()`** &ndash; Triggered when the component unmounts. All in-flight actions are automatically aborted before this handler runs. Protected against React Strict Mode double-invocation via deferred microtask cancellation.
- **`Lifecycle.Update()`** &ndash; Triggered when `context.data` changes. Receives an object with the changed keys.

Because each factory call returns a unique symbol, each component's `Mount`/`Unmount`/`Error`/`Update` is independent &mdash; one component's mount handler never fires for another component in the same boundary.

**Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error()` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

`Lifecycle.Error()` handles errors **locally** where they occurred, allowing component-specific recovery or UI updates. For an app-level catch-all across every component in the boundary, subscribe to the global [`Lifecycle.Fault`](./error-handling.md) broadcast instead.

## `Lifecycle.Fault` (global broadcast)

`Lifecycle.Fault` is a **singleton broadcast** &ndash; not a factory. Every component that subscribes to it receives every fault from anywhere in the surrounding `<Boundary>`:

```ts
actions.useAction(Lifecycle.Fault, (_context, fault) => {
  console.error(`${fault.action} failed:`, fault.error);
});
```

It does not need to be assigned as a static action property &ndash; reference it directly. See [error-handling.md](./error-handling.md) for the full contract.
