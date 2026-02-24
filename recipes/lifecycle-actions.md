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
  static Node = Lifecycle.Node();

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
- **`Lifecycle.Error()`** &ndash; Triggered when an action throws an error. Receives `Fault` as payload.
- **`Lifecycle.Unmount()`** &ndash; Triggered when the component unmounts. All in-flight actions are automatically aborted before this handler runs. Protected against React Strict Mode double-invocation via deferred microtask cancellation.
- **`Lifecycle.Update()`** &ndash; Triggered when `context.data` changes. Receives an object with the changed keys.
- **`Lifecycle.Node()`** &ndash; Triggered when a DOM node is captured via `actions.node()`. Supports channeled subscriptions by node name.

Because each call returns a unique symbol, `context.regulator.disallow(Actions.Mount)` only blocks **this** component's mount — not every component in the boundary.

**Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error()` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. A `Lifecycle.Error()` handler handles errors **locally** where they occurred, allowing component-specific error recovery or UI updates.

## Node capture events

`Lifecycle.Node()` fires whenever a DOM node is captured or released via `actions.node()`. Since it's a channeled action, you can subscribe to specific nodes by name:

```tsx
type Model = {
  count: number;
  nodes: {
    searchInput: HTMLInputElement;
  };
};

export class Actions {
  static Node = Lifecycle.Node();
  static Increment = Action("Increment");
}

const [model, actions] = useActions<Model, typeof Actions>(model);

// Subscribe to all node changes
actions.useAction(Actions.Node, (context, node) => {
  console.log("Some node changed:", node);
});

// Subscribe only to searchInput changes (channeled)
actions.useAction(Actions.Node({ Name: "searchInput" }), (context, node) => {
  if (node) {
    node.focus(); // Node was captured
  }
});

return <input ref={(node) => actions.node("searchInput", node)} />;
```

The payload is the captured node or `null` when the node unmounts.
