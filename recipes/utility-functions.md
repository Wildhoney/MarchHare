# Utility functions

Chizu provides a set of utility functions via the `utils` namespace to help with common patterns. Each utility also has a shorthand Greek letter alias for concise code.

```ts
import { utils } from "chizu";
```

## `utils.set(property)` / `utils.λ`

Creates a generic setter action that updates a specific property in the state. Useful for simple state updates without writing a full action handler:

```ts
class {
  [Actions.Name] = utils.set("name");
  // or using the alias:
  [Actions.Name] = utils.λ("name");
}
```

## `utils.pk()` / `utils.κ`

Generates or validates primary keys. Particularly useful for optimistic updates where items need a temporary identifier before the database responds with the real ID. The symbol acts as a stable reference even if the item moves in an array due to concurrent async operations:

```ts
// Optimistic update: add item with placeholder ID
const id = utils.pk();
context.actions.produce((draft) => {
  draft.model.todos.push({ id, text: "New todo", status: "pending" });
});

// Later when the API responds, find and update with real ID
const response = await api.createTodo({ text: "New todo" });
context.actions.produce((draft) => {
  const todo = draft.model.todos.find((todo) => todo.id === id);
  if (todo) todo.id = response.id; // Replace symbol with real ID
});
```

## `utils.sleep(ms, signal)` / `utils.ζ`

Returns a promise that resolves after the specified milliseconds. Accepts an `AbortSignal` to cancel the sleep early (pass `undefined` when no signal is needed). Useful for simulating delays in actions during development or adding intentional pauses:

```ts
actions.useAction(Actions.Fetch, async (context) => {
  await utils.sleep(1_000, context.task.controller.signal);
  const data = await fetch("/api/data", {
    signal: context.task.controller.signal,
  });
  // ...
});
```

## `utils.poll(ms, signal, fn)` / `utils.π`

Repeatedly calls a function at a fixed interval until it returns `true` or the signal is aborted. The callback is invoked immediately on the first iteration, then after each interval. Useful for polling an API endpoint until a condition is met:

```ts
actions.useAction(Actions.WaitForResult, async (context) => {
  const { signal } = context.task.controller;

  await utils.poll(2_000, signal, async () => {
    const response = await fetch("/api/job/status", { signal });
    const { status } = await response.json();
    context.actions.produce(({ model }) => {
      model.status = status;
    });
    return status === "complete";
  });
});
```
