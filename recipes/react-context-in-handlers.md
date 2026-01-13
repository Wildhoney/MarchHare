# React context in handlers

React hooks like `use()` cannot be called inside action handlers &ndash; they run outside React's render cycle when actions are dispatched. Instead, Chizu provides `context.data` to access external values inside handlers.

## The problem

Action handlers are event callbacks, not React components. Calling hooks inside them violates the Rules of Hooks:

```tsx
// This will NOT work
actions.useAction(Actions.Submit, (context) => {
  const theme = use(ThemeContext); // Rules of Hooks violation
});
```

## The solution

Pass a data function as the second argument to `useActions`. This function runs during render (where hooks are valid) and captures values for use in handlers:

```tsx
import { useActions } from "chizu";

type Data = { theme: Theme; user: User };

export function useFormActions() {
  const actions = useActions<Model, typeof Actions, Data>(model, () => ({
    theme: use(ThemeContext),
    user: use(UserContext),
  }));

  actions.useAction(Actions.Submit, async (context) => {
    // Access context values via data
    const { theme, user } = context.data;

    await submitForm(context.model, user);

    // Data always reflects the latest value, even after await
    console.log(context.data.theme);
  });

  return actions;
}
```

## Why data stays fresh

The data function runs on every render, capturing the latest values. When you access `context.data` in an async handler &ndash; even after multiple `await` statements &ndash; you get the current value, not a stale closure.

```tsx
actions.useAction(Actions.LongRunning, async (context) => {
  console.log(context.data.count); // e.g., 1

  await sleep(5000);

  // If count changed during the wait, data reflects the new value
  console.log(context.data.count); // e.g., 5
});
```

This makes `context.data` ideal for accessing props, context, or any reactive values that may change during async operations.
