# Stateful props

Chizu uses the `Box<T>` type from [Immertation](https://github.com/Wildhoney/Immertation) to wrap values with metadata about their async state. Passing `Box<T>` to React components allows them to observe an object's state &ndash; checking if a value is pending, how many operations are in flight, and what the optimistic draft value is &ndash; all without additional state management.

The `Box<T>` type has two properties:

- **`box.value`** &ndash; The payload (e.g., `Country` object with `name`, `flag`, etc.).
- **`box.inspect`** &ndash; An `Inspect<T>` proxy for checking annotation status:
  - `box.inspect.pending()` &ndash; Returns `true` if any pending annotations exist.
  - `box.inspect.remaining()` &ndash; Returns the count of pending annotations.
  - `box.inspect.draft()` &ndash; Returns the draft value from the latest annotation.
  - `box.inspect.is(Op.Update)` &ndash; Checks if the annotation matches a specific operation.
