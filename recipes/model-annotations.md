# Model annotations

Model annotations allow you to track the state of async operations on individual model fields. This is useful for showing loading indicators, optimistic updates, and tracking pending changes. Annotations are powered by [Immertation](https://github.com/Wildhoney/Immertation) &ndash; refer to its documentation for more details.

Use `context.actions.annotate` to mark a value with an operation type. The `produce` callback receives a draft object with `model` and `inspect` properties, allowing you to read the current draft value when making changes:

```ts
import { Op } from "chizu";

context.actions.produce((draft) => {
  draft.model.count = context.actions.annotate(
    Op.Update,
    draft.inspect.count.draft() + 1,
  );
});
```

This pattern is essential for concurrent operations &ndash; when multiple actions are in flight, `draft.inspect.count.draft()` returns the most recent pending value, ensuring each action builds on the latest state rather than the committed model value.

In the view, use `actions.inspect` to check the state of annotated fields:

```ts
actions.inspect.name.pending(); // true if operation is in progress
actions.inspect.name.remaining(); // count of pending operations
actions.inspect.name.draft(); // the draft value (latest annotation or model value)
actions.inspect.name.is(Op.Update); // check specific operation type
```

**Note:** `draft()` always returns a value &ndash; either the most recent annotation's value or the current model value if no annotations exist. It never returns `undefined` for defined model properties.
