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

## `Consumer` (Internal)

The Consumer context is an internal mechanism and does not need to be used directly. Broadcast values are cached automatically by the `BroadcastEmitter`.
