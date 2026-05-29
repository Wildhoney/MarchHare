# Context providers

March Hare provides context providers for advanced use cases where you need isolated contexts. These are edge cases &ndash; most applications don't need them.

## `Broadcaster`

Creates an isolated broadcast context for broadcast actions. Useful for libraries that want their own broadcast context without interfering with the host application:

```tsx
import { Broadcaster } from "march-hare";

function MyLibraryRoot({ children }) {
  return <Broadcaster>{children}</Broadcaster>;
}
```

Components inside `<Broadcaster>` have their own isolated broadcast controller. Broadcast actions dispatched inside won't reach components outside, and vice versa.

## `Consumer` (Internal)

The Consumer context is an internal mechanism and does not need to be used directly. Broadcast values are cached automatically by the `BroadcastEmitter`.
