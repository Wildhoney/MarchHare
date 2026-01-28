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
- **`Lifecycle.Error`** &ndash; Triggered when an action throws an error. Receives `Fault` as payload.
- **`Lifecycle.Unmount`** &ndash; Triggered when the component unmounts. All in-flight actions are automatically aborted before this handler runs.
- **`Lifecycle.Update`** &ndash; Triggered when `context.data` changes. Receives an object with the changed keys.
- **`Lifecycle.Element`** &ndash; Triggered when a DOM element is captured via `actions.element()`. Supports channeled subscriptions by element name.

**Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. `Lifecycle.Error` handles errors **locally** where they occurred, allowing component-specific error recovery or UI updates.

## Element capture events

`Lifecycle.Element` fires whenever a DOM element is captured or released via `actions.element()`. Since it's a channeled action, you can subscribe to specific elements by name:

```tsx
type Model = {
  count: number;
  elements: {
    searchInput: HTMLInputElement;
  };
};

const [model, actions] = useActions<Model, typeof Actions>(model);

// Subscribe to all element changes
actions.useAction(Lifecycle.Element, (context, element) => {
  console.log("Some element changed:", element);
});

// Subscribe only to searchInput changes (channeled)
actions.useAction(
  Lifecycle.Element({ Name: "searchInput" }),
  (context, element) => {
    if (element) {
      element.focus(); // Element was captured
    }
  },
);

return <input ref={(el) => actions.element("searchInput", el)} />;
```

The payload is the captured element or `null` when the element unmounts.
