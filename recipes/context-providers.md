# Context providers

Chizu provides context providers for advanced use cases where you need isolated contexts. These are edge cases &ndash; most applications don't need them.

## `Broadcaster`

Creates an isolated broadcast context for broadcast actions. Useful for libraries that want their own broadcast context without interfering with the host application:

```tsx
import { Broadcaster } from "chizu";

function MyLibraryRoot({ children }) {
  return <Broadcaster>{children}</Broadcaster>;
}
```

Components inside `<Broadcaster>` have their own isolated broadcast channel. Broadcast actions dispatched inside won't reach components outside, and vice versa.

## `Regulators`

Creates an isolated regulator context. All regulator operations (`abort.all()`, `policy.disallow.matching()`, etc.) only affect components within the same `Regulators` provider:

```tsx
import { Regulators } from "chizu";

function Example({ children }) {
  return <Regulators>{children}</Regulators>;
}
```

This is useful for libraries that need action control without affecting the host application's actions. An `abort.all()` inside the provider won't abort actions outside it.

## `Consumer`

Creates an isolated consumer context for storing broadcast action values. The Consumer stores the latest payload for each broadcast action, enabling the `consume()` method to display the most recent value even when components mount after the action was dispatched:

```tsx
import { Consumer } from "chizu";

function MyLibraryRoot({ children }) {
  return <Consumer>{children}</Consumer>;
}
```

Components inside `<Consumer>` have their own isolated value store. Actions consumed inside won't see values dispatched outside, and vice versa. This is useful for libraries that want to use `consume()` without interfering with the host application's consumed values.

**Note:** In most applications, you don't need to provide a `Consumer` &ndash; one is created automatically at the default context level. Only use `<Consumer>` when you need isolation for library boundaries or testing.
