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

## `utils.checksum(value)` / `utils.Σ`

Generates a deterministic hash string from any value. Returns `null` if the value cannot be serialised (e.g., circular references). Useful for creating cache keys, comparing object equality, or tracking changes:

```ts
const hash = utils.checksum({ userId: 123, filters: { active: true } });
// Returns a stable hash string like "1a2b3c4d"

// Use for cache keys or change detection
if (utils.checksum(currentData) !== utils.checksum(previousData)) {
  // Data has changed...
}
```

## `utils.sleep(ms, signal?)` / `utils.ζ`

Returns a promise that resolves after the specified milliseconds. Useful for simulating delays in actions during development or adding intentional pauses. Optionally accepts an `AbortSignal` to cancel the sleep early:

```ts
const fetch = useAction<Action, "Fetch">(async (context) => {
  await utils.sleep(1_000); // Simulate network delay
  const data = await fetch("/api/data", { signal: context.signal });
  // ...
});
```
