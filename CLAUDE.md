# Chizu AI Assistant Guide

Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

## Quick Reference

```ts
import {
  Action,
  Distribution,
  Lifecycle,
  useActions,
  With,
  utils,
  withScope,
  useMode,
  Boundary,
  Error,
  Reason,
  Op,
  Operation,
} from "chizu";
import type {
  Box,
  Fault,
  Handler,
  Handlers,
  ModeHandle,
  Pk,
  Task,
  Tasks,
} from "chizu";
```

## Core Concepts

Chizu is an event-driven state management library for React built on the publish-subscribe pattern. Key concepts:

- **Model:** The application state, a plain JavaScript object. Pass `void` for actions-only components with no local state.
- **Actions:** Typed events that trigger state changes. Created with `Action<Payload>("name")`.
- **`useActions` hook:** Returns `[model, actions]` tuple with pre-typed methods. Use `useActions<void, typeof Actions>()` when no model is needed.
- **`actions.useAction`:** Registers handlers for actions. Receives `context` and `payload`.
- **`context.actions.produce`:** Immutable state updates via Immer/Immertation. Receives `{ model, inspect }`.
- **`context.data`:** Reactive external values (props, context) that stay fresh after `await`.

### Basic Example

```tsx
import { useActions, Action, With } from "chizu";

type Model = { name: string | null };

export class Actions {
  static Name = Action<string>("Name");
}

export function useNameActions() {
  const actions = useActions<Model, typeof Actions>({ name: null });

  // Simple assignment using With.Update helper
  actions.useAction(Actions.Name, With.Update("name"));

  return actions;
}

// In component
function Profile() {
  const [model, actions] = useNameActions();
  return (
    <button onClick={() => actions.dispatch(Actions.Name, "Adam")}>
      Hello {model.name}
    </button>
  );
}
```

## Action Distribution Types

```ts
import { Action, Distribution } from "chizu";

// Unicast (default) - only the dispatching component handles it
static Increment = Action("Increment");
static SetCount = Action<number>("SetCount");

// Broadcast - all mounted components receive it
static UserUpdated = Action<User>("UserUpdated", Distribution.Broadcast);

// Multicast - components inside the matching withScope boundary receive it
static Update = Action<number>("Update", Distribution.Multicast);
```

### Channeled Actions

Target specific handlers using channel objects:

```ts
// Second generic defines the channel type
static UserUpdated = Action<User, { UserId: number }>("UserUpdated");

// Subscribe to specific user only
actions.useAction(Actions.UserUpdated({ UserId: props.userId }), handler);

// Dispatch to specific channel
actions.dispatch(Actions.UserUpdated({ UserId: 5 }), user);

// Dispatch to ALL handlers (plain + all channeled)
actions.dispatch(Actions.UserUpdated, user);
```

Channel values must be non-nullable primitives: `string`, `number`, `bigint`, `boolean`, or `symbol`. By convention, use uppercase keys like `{UserId: 4}`.

## Lifecycle Actions

Lifecycle actions are **factory functions** that return unique symbols per call. Assign them as static properties in your Actions class for per-component regulation support:

```ts
import { Lifecycle } from "chizu";

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Error = Lifecycle.Error();
  static Update = Lifecycle.Update();

  static Increment = Action("Increment");
}

actions.useAction(Actions.Mount, (context) => {
  // Setup logic - runs once on mount (useLayoutEffect timing)
});

actions.useAction(Actions.Unmount, (context) => {
  // Cleanup - runs when component unmounts
  // All in-flight actions are automatically aborted before this runs
});

actions.useAction(Actions.Error, (context, fault) => {
  // Handle errors from other actions locally
  // fault: { reason, error, action, handled, tasks }
});

actions.useAction(Actions.Update, (context, changes) => {
  // Triggered when context.data changes (not on initial mount)
  // changes: Record<string, unknown> with changed keys
});
```

## Handler Context API

Every action handler receives `context` as first argument:

```ts
actions.useAction(Actions.Fetch, async (context, payload) => {
  // Read-only model snapshot
  context.model;

  // Current lifecycle phase: Mounting | Mounted | Unmounting | Unmounted
  context.phase;

  // Current task info: { controller: AbortController, action, payload }
  context.task;

  // All running tasks across all components
  context.tasks;

  // Reactive data (always latest values, even after await)
  context.data;

  // Actions API
  context.actions.produce(({ model, inspect }) => {
    // Immer-style mutations on model
    // inspect.fieldName.draft() for reading current draft value
  });

  // Awaitable — resolves when all triggered handlers complete.
  // Generator handlers run in the background and do not block.
  await context.actions.dispatch(action, payload, options?);

  context.actions.annotate(Op.Update, value); // Mark async state

  // Resolve latest broadcast/multicast value (waits for settled annotations)
  const user = await context.actions.resolution(Actions.Broadcast.User);
  // Returns Promise<T | null>

  // Peek at latest value immediately (no waiting)
  const current = context.actions.peek(Actions.Broadcast.User);
  // Returns T | null
});
```

### JSX Stream (Declarative Rendering)

Render broadcast values directly in JSX without storing in local model:

```tsx
const [model, actions] = useDashboardActions();

return (
  <div>
    {actions.stream(Actions.Broadcast.User, (user, inspect) => (
      <span>Welcome, {user.name}</span>
    ))}
  </div>
);
```

Returns `null` until the first dispatch. The renderer receives `(value, inspect)` — use `inspect` for annotation status.

## Model Annotations (Async State Tracking)

Track async operation state per field using Immertation:

```ts
import { Op } from "chizu";

actions.useAction(Actions.Fetch, async (context) => {
  // Mark field as pending
  context.actions.produce(({ model, inspect }) => {
    model.user = inspect.annotate(Op.Update, model.user);
  });

  const user = await fetchUser();

  // Update with result
  context.actions.produce(({ model }) => {
    model.user = user;
  });
});

// In component - check annotation state
const [model, actions] = useMyActions();

actions.inspect.user.pending(); // true if operation in progress
actions.inspect.user.remaining(); // count of pending operations
actions.inspect.user.draft(); // draft value (latest annotation or model)
actions.inspect.user.is(Op.Update); // check specific operation
```

## Multicast Pattern

Each multicast action defines its own scope &mdash; pass the same action to `withScope` and to `dispatch`. There is no separate scope name.

```tsx
// types.ts — group multicast actions on a class named `Scope`.
export class Scope {
  static Mood = Action<Mood>("Mood", Distribution.Multicast);
}

// Parent opens the scope by wrapping the subtree.
function MoodArea() {
  return (
    <>
      <Happy />
      <Sad />
    </>
  );
}
export default withScope(Scope.Mood, MoodArea);

// Dispatch and subscribe with no extra options.
actions.dispatch(Scope.Mood, mood);

actions.useAction(Scope.Mood, (context, mood) => {
  context.actions.produce(({ model }) => {
    model.selected = mood;
  });
});
```

## Utility Functions

```ts
import { utils } from "chizu";

// Sleep with abort signal
await utils.sleep(1000, context.task.controller.signal);
utils.ζ(1000, signal); // Greek alias

// Poll until condition is met
await utils.poll(2_000, context.task.controller.signal, async () => {
  const res = await fetch("/api/status");
  return (await res.json()).done === true;
});
utils.π(2_000, signal, fn); // Greek alias

// Primary key generation for optimistic updates
const tempId = utils.pk(); // Generate unique symbol
utils.pk(id); // Validate: true if not a symbol
utils.κ(); // Greek alias
```

## Helper Functions

### `With.Update(property)` &mdash; Bind payload to a model field

```ts
// Bind action payload directly to model property
actions.useAction(Actions.SetName, With.Update("name"));

// Equivalent to:
actions.useAction(Actions.SetName, (context, name) => {
  context.actions.produce(({ model }) => {
    model.name = name;
  });
});
```

The helper type-checks at the call site: the payload type must be assignable to `model[key]`.

### `With.Invert(property)` &mdash; Flip a boolean field

```ts
// Toggle a boolean model property (payload is ignored)
actions.useAction(Actions.ToggleSidebar, With.Invert("sidebar"));

// Equivalent to:
actions.useAction(Actions.ToggleSidebar, (context) => {
  context.actions.produce(({ model }) => {
    model.sidebar = !model.sidebar;
  });
});
```

`With.Invert` only compiles when the named property is a boolean on the model. Use it for modals, drawers, panels, and similar binary UI state &mdash; the field lives directly on the model with no special wrapper.

## Error Handling

### Global Error Handler

```tsx
import { Error, Reason } from "chizu";

<Error
  handler={({ reason, error, action, handled, tasks }) => {
    switch (reason) {
      case Reason.Timedout: // Action exceeded timeout
      case Reason.Supplanted: // Newer action instance dispatched
      case Reason.Errored: // Uncaught error
    }
  }}
>
  <App />
</Error>;
```

### Abort Patterns

```ts
// Pass signal to fetch for automatic cancellation
actions.useAction(Actions.Fetch, async (context) => {
  const response = await fetch("/api", {
    signal: context.task.controller.signal,
  });
});

// Combine with timeout
actions.useAction(Actions.Fetch, async (context) => {
  const response = await fetch("/api", {
    signal: AbortSignal.any([
      context.task.controller.signal,
      AbortSignal.timeout(5_000),
    ]),
  });
});

// Debouncing - sleep aborts when new dispatch occurs
actions.useAction(Actions.Search, async (context, query) => {
  await utils.sleep(300, context.task.controller.signal);
  const results = await fetch(`/search?q=${query}`);
});
```

## Mode (Per-Boundary Coordination Value)

A single mutable value shared across every component inside a `<Boundary>`. Mode is **opt-in**: components that need it call `useMode()` and thread the handle through the `useActions` data callback. Mode is **not** reactive &mdash; mutating it does not re-render. Use it for cross-handler coordination only; drive view state through the model.

```ts
import { useMode, useActions, Action } from "chizu";

enum Mode {
  Idle,
  SigningOut,
}

function useSignOutActions() {
  const mode = useMode<Mode>();
  // Spell the data shape as the third generic so `context.data.mode` keeps
  // its concrete type inside handlers.
  const actions = useActions<Model, typeof Actions, { mode: typeof mode }>(
    model,
    () => ({ mode }),
  );

  actions.useAction(Actions.SignOut, async (context) => {
    context.data.mode.update(Mode.SigningOut);
    await api.signOut();
    context.data.mode.update(Mode.Idle);
  });

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.data.mode.read() === Mode.SigningOut) return;
    // ...
  });

  return actions;
}
```

`context.data.mode` is fully typed via the `useActions` data generic, no extra annotations needed. Reads stay fresh across `await` boundaries because `context.data` already does.

## Context Providers

### `<Boundary>` - All-in-one Provider

```tsx
import { Boundary } from "chizu";

// Wraps app with Broadcaster, Mode, and Tasks providers
<Boundary>
  <App />
</Boundary>;
```

### Multicast scope boundaries

```tsx
import { withScope } from "chizu";

// Wrap a component with the multicast action that opens its scope.
const ScopedArea = withScope(Scope.Mood, MoodArea);
```

## Reactive Data (Avoiding Stale Closures)

Pass external values via `useActions` data callback for access after `await`:

```ts
function useSearchActions(props: { query: string }) {
  const actions = useActions<Model, typeof Actions, { query: string }>(
    model,
    () => ({ query: props.query }),
  );

  actions.useAction(Actions.Search, async (context) => {
    await fetch("/search");
    // context.data.query is ALWAYS the latest value, even after await
    console.log(context.data.query);
  });

  return actions;
}
```

## Type Utilities

### `Handler<M, AC, K, D>` - Single Handler Type

```ts
import { Handler } from "chizu";

const handleSetName: Handler<Model, typeof Actions, "SetName"> = (
  context,
  name,
) => {
  context.actions.produce(({ model }) => {
    model.name = name;
  });
};
```

### `Handlers<M, A, D>` - HKT for All Handlers

```ts
import { Handlers } from "chizu";

type H = Handlers<Model, typeof Actions>;

// Index to get specific handler type
const handleSetName: H["SetName"] = (context, name) => { ... };
const handleSetAge: H["SetAge"] = (context, age) => { ... };
```

### `Pk<T>` - Primary Key Type

```ts
import type { Pk } from "chizu";

type Todo = {
  id: Pk<number>; // undefined | symbol | number
  text: string;
};
```

## Component Structure

For feature components, use this folder structure:

```
feature/
├── index.tsx          # Main component (often wrapped via withScope)
├── types.ts           # Model type, enums, multicast Scope class
├── styles.ts          # Emotion CSS styles
├── utils.ts           # Utility functions
└── components/
    └── sub-feature/
        ├── index.tsx  # Component UI
        ├── actions.ts # useXxxActions hook with handlers
        └── types.ts   # Actions class for this component
```

## Coding Standards

- Use `type` instead of `interface`.
- Use `export function` instead of `export const () =>`.
- All comments and documentation must be written in British-English.
- Keep dispatch logic in actions.ts, not in component files.
- Group multicast actions on a class named `Scope`; reference each action directly (e.g. `Scope.Update`) at the dispatch and `withScope` call sites.
- Use `context.actions.produce` for all state mutations.
- Pass abort signals to async operations: `signal: context.task.controller.signal`.

## Development Workflow

After each change, run `make checks`. This command will format, lint, typecheck, and run unit tests.

Do not update the `CHANGELOG.md` file, as this is handled automatically during the release process.

If you make any changes to the library, ensure that the `README.md` file and relevant recipes are updated.

## Commit Message Format

The project follows the Conventional Commits specification:

```
<type>(<scope>): <description>
```

- **type**: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `style`, `revert`
- **scope** (optional): The scope of the change (e.g., `release`, `core`, `hooks`).
- **description**: A short, lowercase description of the change.

Examples:

```
feat(hooks): add a new hook for something
fix(core): correct a bug in the main logic
docs: update the README file
```

## Key Files

### Library Core

- `src/library/index.ts` - Main exports
- `src/library/hooks/index.ts` - useActions hook implementation
- `src/library/hooks/utils.ts` - With helper, useData, useLifecycles
- `src/library/action/index.ts` - Action factory function
- `src/library/types/index.ts` - All TypeScript types and interfaces
- `src/library/utils/index.ts` - sleep, pk utilities
- `src/library/error/index.tsx` - Error component and Reason enum

### Boundary Components

- `src/library/boundary/index.tsx` - Boundary all-in-one provider
- `src/library/boundary/components/scope/` - Multicast scope implementation
- `src/library/boundary/components/broadcast/` - Broadcast system
- `src/library/boundary/components/consumer/` - Consumer store (internal)
- `src/library/boundary/components/tasks/` - Task tracking context
- `src/library/boundary/components/mode/` - Per-Boundary mode handle context

### Documentation

- `recipes/` - Advanced usage patterns and documentation
  - `action-control-patterns.md` - Cancellation, timeouts, retries, debouncing
  - `broadcast-actions.md` - Cross-component communication
  - `channeled-actions.md` - Targeted event delivery
  - `reading-actions.md` - Reading and streaming broadcast values: handler resolution(), peek(), and JSX stream()
  - `context-providers.md` - Boundary, Broadcaster, Consumer
  - `error-handling.md` - Error component and fault handling
  - `ky-http-client.md` - Integration with ky HTTP client
  - `lifecycle-actions.md` - Mount, Unmount, Error, Update
  - `mode.md` - Per-Boundary handler coordination value
  - `mount-broadcast-deduplication.md` - Avoiding duplicate fetches on mount with broadcast/multicast
  - `model-annotations.md` - Async state tracking with Immertation
  - `multicast-actions.md` - Scoped component communication
  - `react-context-in-handlers.md` - Using context.data
  - `real-time-applications.md` - SSE/WebSocket patterns
  - `referential-equality.md` - Avoiding stale closures
  - `stateful-props.md` - Box<T> type for stateful props
  - `use-resource.md` - useResource for cached fetches with subscriptions and typed errors
  - `utility-functions.md` - sleep, pk utilities
  - `utility-types.md` - Handler, Handlers types
  - `void-model.md` - Actions without local state
