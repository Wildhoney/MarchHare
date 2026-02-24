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

Creates an isolated regulator context for action regulation. Use this when you need a separate regulation policy &ndash; for example, a library that wants its own regulation boundary without affecting the host application:

```tsx
import { Regulators } from "chizu";

function MyLibraryRoot({ children }) {
  return <Regulators>{children}</Regulators>;
}
```

Components inside `<Regulators>` share a regulation policy. Calling `context.regulator.disallow.all()` in one component blocks actions for all components within the same `<Regulators>` boundary. The `<Boundary>` component includes `<Regulators>` automatically.

See the [action regulator recipe](./action-regulator.md) for full details.

## `Consumer` (Internal)

The Consumer context is an internal mechanism and does not need to be used directly. Broadcast values are cached automatically by the `BroadcastEmitter`.
