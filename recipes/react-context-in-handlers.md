# React context in handlers

React hooks like [`use()`](https://react.dev/reference/react/use) (imported from `react`) cannot be called inside action handlers &ndash; they run outside React's render cycle when actions are dispatched. Instead, March Hare provides `context.data` to access external values inside handlers and a third tuple element on `context.useActions` to expose the same snapshot to JSX.

## The problem

Action handlers are event callbacks, not React components. Calling hooks inside them violates the Rules of Hooks:

```tsx
import { use } from "react";

// This will NOT work
actions.useAction(Actions.Submit, (context) => {
  const theme = use(ThemeContext); // Rules of Hooks violation
});
```

## The solution

Pass a data function as the second argument to `context.useActions`. This function runs during render (where hooks are valid) and captures values for use in handlers:

```tsx
import { use } from "react";
import { app } from "./app";

type Data = { theme: Theme; user: User };

export function useActions() {
  const context = app.useContext<Model, typeof Actions, Data>();
  const actions = context.useActions(model, () => ({
    theme: use(ThemeContext),
    user: use(UserContext),
  }));

  actions.useAction(Actions.Submit, async (context) => {
    // Read context values via context.data — dot notation at the access
    // site so every read returns the latest value, even after await.
    await submitForm(context.model, context.data.user);
    console.log(context.data.theme);
  });

  return actions;
}
```

## Reading data in JSX

`context.useActions` returns a tuple `[model, actions, data]`. The third element is the same Proxy your handlers read via `context.data`, refreshed synchronously each render so JSX sees the current values. This lets a wrapper hook own all React-side dependencies internally and expose them through one named source:

```tsx
function Form() {
  const [model, actions, data] = useActions();

  return (
    <fieldset className={data.theme === "dark" ? "is-dark" : "is-light"}>
      <span>Signed in as {data.user.name}</span>
      <button onClick={() => actions.dispatch(Actions.Submit)}>Submit</button>
      {model.error && <ErrorBanner message={model.error} />}
    </fieldset>
  );
}
```

The mental model is symmetric across the read sites:

| Owned by   | Re-render trigger         | Read in JSX | Read in handler   |
| ---------- | ------------------------- | ----------- | ----------------- |
| React      | Hook emits a new value    | `data.X`    | `context.data.X`  |
| March Hare | `context.actions.produce` | `model.X`   | `context.model.X` |

`data` is read-only from both sides. If a handler needs to _write_ something, that value belongs on the model. If a handler needs to _react_ to a change in `data`, subscribe to `Lifecycle.Update()` &mdash; it fires whenever `getData`'s result differs from the previous render and delivers the changed keys.

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

## When to use the third tuple element

Reach for `data` in JSX when:

- A wrapper hook owns React-side dependencies (`useTheme()`, `useCheckout()`, an SDK client) and you want the consuming component to read them without re-importing the hook.
- You want a single named source for "things this feature depends on" that both handlers and JSX read.
- You're tempted to mirror a React value onto the model via a `dispatch(SetX, value)` call inside a `useEffect` &mdash; almost always a sign the value belongs in `data`, not on the model.

Keep using the model when:

- A handler writes to the field via `context.actions.produce`.
- JSX renders against state that march-hare itself produced (annotated drafts, async results, optimistic updates).
