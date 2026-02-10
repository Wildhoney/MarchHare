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

- **`Lifecycle.Mount`** &ndash; Triggered once when the component mounts (`useLayoutEffect`). Protected against React Strict Mode double-invocation.
- **`Lifecycle.Error`** &ndash; Triggered when an action throws an error. Receives `Fault` as payload.
- **`Lifecycle.Unmount`** &ndash; Triggered when the component unmounts. All in-flight actions are automatically aborted before this handler runs. Protected against React Strict Mode double-invocation via deferred microtask cancellation.
- **`Lifecycle.Update`** &ndash; Triggered when `context.data` changes. Receives an object with the changed keys.
- **`Lifecycle.Node`** &ndash; Triggered when a DOM node is captured via `actions.node()`. Supports channeled subscriptions by node name.

**Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. `Lifecycle.Error` handles errors **locally** where they occurred, allowing component-specific error recovery or UI updates.

## Node capture events

`Lifecycle.Node` fires whenever a DOM node is captured or released via `actions.node()`. Since it's a channeled action, you can subscribe to specific nodes by name:

```tsx
type Model = {
  count: number;
  nodes: {
    searchInput: HTMLInputElement;
  };
};

const [model, actions] = useActions<Model, typeof Actions>(model);

// Subscribe to all node changes
actions.useAction(Lifecycle.Node, (context, node) => {
  console.log("Some node changed:", node);
});

// Subscribe only to searchInput changes (channeled)
actions.useAction(Lifecycle.Node({ Name: "searchInput" }), (context, node) => {
  if (node) {
    node.focus(); // Node was captured
  }
});

return <input ref={(node) => actions.node("searchInput", node)} />;
```

The payload is the captured node or `null` when the node unmounts.
