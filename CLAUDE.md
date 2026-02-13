# Chizu AI Assistant Guide

Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

## Quick Reference

```ts
import {
  Action,
  Entry,
  Distribution,
  Lifecycle,
  useActions,
  With,
  utils,
  Scope,
  Boundary,
  Error,
  Reason,
  Op,
  Operation,
} from "chizu";
import type {
  Box,
  CacheId,
  ChanneledCacheId,
  Fault,
  Handler,
  Handlers,
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

  // Simple assignment using With helper
  actions.useAction(Actions.Name, With("name"));

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

// Multicast - components within a named <Scope> receive it
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

```ts
import { Lifecycle } from "chizu";

actions.useAction(Lifecycle.Mount, (context) => {
  // Setup logic - runs once on mount (useLayoutEffect timing)
});

actions.useAction(Lifecycle.Unmount, (context) => {
  // Cleanup - runs when component unmounts
  // All in-flight actions are automatically aborted before this runs
});

actions.useAction(Lifecycle.Error, (context, fault) => {
  // Handle errors from other actions locally
  // fault: { reason, error, action, handled, tasks }
});

actions.useAction(Lifecycle.Update, (context, changes) => {
  // Triggered when context.data changes (not on initial mount)
  // changes: Record<string, unknown> with changed keys
});

actions.useAction(Lifecycle.Node, (context, node) => {
  // Triggered when any DOM node is captured via actions.node()
});

// Channeled node subscription for specific nodes
actions.useAction(Lifecycle.Node({ Name: "input" }), (context, node) => {
  if (node) node.focus();
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

  // Captured DOM nodes
  context.nodes;

  // Actions API
  context.actions.produce(({ model, inspect }) => {
    // Immer-style mutations on model
    // inspect.fieldName.draft() for reading current draft value
  });

  context.actions.dispatch(action, payload, options?);

  context.actions.annotate(Op.Update, value); // Mark async state

  // Consume latest broadcast/multicast value imperatively
  const user = await context.actions.consume(Actions.Broadcast.User);
  // Returns Promise<T | null> — waits for Immertation annotations to settle
});
```

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

For scoped component communication:

```tsx
// types.ts - shared multicast actions
export class MulticastActions {
  static Mood = Action<Mood>("Mood", Distribution.Multicast);
}

// component/types.ts - reference shared multicast
export class Actions {
  static Multicast = MulticastActions; // Always at top of class
}

// Parent defines scope boundary
<Scope name="mood">
  <Happy />
  <Sad />
</Scope>;

// Dispatch multicast directly to scope
actions.dispatch(Actions.Multicast.Mood, mood, { scope: "mood" });

// Handle multicast from any component in scope
actions.useAction(Actions.Multicast.Mood, (context, mood) => {
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

### `With(property)` - Simple Property Binding

```ts
// Bind action payload directly to model property
actions.useAction(Actions.SetName, With("name"));

// Equivalent to:
actions.useAction(Actions.SetName, (context, name) => {
  context.actions.produce(({ model }) => {
    model.name = name;
  });
});
```

## DOM Node Capture

Capture DOM nodes for access in handlers:

```tsx
type Model = {
  count: number;
  nodes: {
    input: HTMLInputElement;
    container: HTMLDivElement;
  };
};

const [model, actions] = useActions<Model, typeof Actions>(initialModel);

// In JSX
<div ref={(node) => actions.node("container", node)}>
  <input ref={(node) => actions.node("input", node)} />
</div>;

// In handlers
actions.useAction(Actions.Focus, (context) => {
  context.nodes.input?.focus();
});

// Or access from actions object
actions.nodes.input?.focus();
```

## Error Handling

### Global Error Handler

```tsx
import { Error, Reason } from "chizu";

<Error
  handler={({ reason, error, action, handled, tasks }) => {
    switch (reason) {
      case Reason.Timedout: // Action exceeded timeout
      case Reason.Supplanted: // Newer action instance dispatched
      case Reason.Disallowed: // Blocked by regulator
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

## Context Providers

### `<Boundary>` - All-in-one Provider

```tsx
import { Boundary } from "chizu";

// Wraps app with Broadcaster and Tasks providers
<Boundary>
  <App />
</Boundary>;
```

### Individual Providers (for isolation)

```tsx
import { Broadcaster, Regulators, Scope } from "chizu";

// Isolated broadcast context (for libraries)
<Broadcaster>{children}</Broadcaster>

// Isolated regulator context
<Regulators>{children}</Regulators>

// Multicast scope boundary
<Scope name="ScopeName">{children}</Scope>
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
├── index.tsx          # Main component with <Scope> if needed
├── types.ts           # Model type, enums, shared MulticastActions
├── styles.ts          # Emotion CSS styles
├── utils.ts           # Utility functions
└── components/
    └── sub-feature/
        ├── index.tsx  # Component UI
        ├── actions.ts # useXxxActions hook with handlers
        └── types.ts   # Actions class with Multicast reference
```

## Coding Standards

- Use `type` instead of `interface`.
- Use `export function` instead of `export const () =>`.
- All comments and documentation must be written in British-English.
- Keep dispatch logic in actions.ts, not in component files.
- Place `static Multicast = MulticastActions;` at the top of Action classes.
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
- `src/library/boundary/components/cache/` - Cache store context
- `src/library/cache/index.ts` - Entry factory and cache utilities

### Documentation

- `recipes/` - Advanced usage patterns and documentation
  - `action-control-patterns.md` - Cancellation, timeouts, retries, debouncing
  - `action-regulator.md` - Regulator API for abort/policy control
  - `broadcast-actions.md` - Cross-component communication
  - `caching.md` - TTL-based caching with cacheable/invalidate
  - `channeled-actions.md` - Targeted event delivery
  - `consuming-actions.md` - Reading broadcast values in handlers with consume()
  - `context-providers.md` - Boundary, Broadcaster, Consumer, Regulators
  - `error-handling.md` - Error component and fault handling
  - `ky-http-client.md` - Integration with ky HTTP client
  - `lifecycle-actions.md` - Mount, Unmount, Error, Update, Node
  - `model-annotations.md` - Async state tracking with Immertation
  - `multicast-actions.md` - Scoped component communication
  - `react-context-in-handlers.md` - Using context.data
  - `real-time-applications.md` - SSE/WebSocket patterns
  - `referential-equality.md` - Avoiding stale closures
  - `stateful-props.md` - Box<T> type for stateful props
  - `utility-functions.md` - sleep, pk utilities
  - `utility-types.md` - Handler, Handlers types
  - `void-model.md` - Actions without local state
