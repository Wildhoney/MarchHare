# Lifecycle actions

March Hare provides lifecycle actions that trigger at specific points in a component's lifecycle. Lifecycle actions are **factory functions** — each call to `Lifecycle.Mount()` returns a unique action symbol, enabling per-component regulation.

Assign lifecycle factories as static properties in your Actions class:

```ts
import { Action, Lifecycle } from "march-hare";
import { app } from "./app";

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Error = Lifecycle.Error();
  static Update = Lifecycle.Update();

  static Increment = Action("Increment");
}

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

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
- **`Lifecycle.Update()`** &ndash; Fires once on mount (with the initial data keys, or `{}` when there is no data), then whenever `context.data` changes. The handler payload is typed as `Partial<DeepReadonly<D>>` against the `useContext` data generic &ndash; only the keys whose values changed between the previous and current render are present, each carrying the data shape's exact type. The mount fire runs while `context.phase` is `Mounting`. A user-defined `Action<P>("Update")` does **not** pick up this typing &mdash; the special case is keyed off the `Lifecycle.Update` factory.
- **`Lifecycle.Reactive<T>()`** &ndash; A per-value reactive trigger. Declare it as a static, then bind an external value at the `useAction` site by calling it (`actions.useAction(Actions.User(user), handler)`). The handler fires whenever the bound value changes by `Object.is`, receiving the latest value as its payload, and once on mount with the current value &mdash; defined (a hydrated React Query cache) or `undefined`. Like `Lifecycle.Update()`, the mount fire runs during `Mounting`. See the [reactive values recipe](./reactive-values.md) for the full firing table and the React Query bridge.

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

## `Lifecycle.Env` (global broadcast)

`Lifecycle.Env` is a **singleton broadcast** &ndash; same shape as `Lifecycle.Fault`. It fires whenever a `context.actions.produce(({ env }) => ...)` call mutates the Env, delivering the full latest snapshot to every subscriber in the surrounding `<Boundary>`. The initial Env passed to `<Boundary env={...}>` seeds the broadcast cache, so late-mounting subscribers and `stream(...)` consumers see the current value on mount.

```ts
actions.useAction(Lifecycle.Env, (context, env) => {
  console.log("env changed", env);
});
```

Render directly against the env in JSX with `stream`:

```tsx
{
  actions.stream(Lifecycle.Env, (env) => <span>{env.locale}</span>);
}
```

Reference it directly &ndash; no need to assign it as a static action property. The handler does **not** fire when a `produce` call mutates only the model; the slot reference is checked after each `produce` and the broadcast is emitted only when it changes. See [env.md](./env.md) for full Env semantics.
