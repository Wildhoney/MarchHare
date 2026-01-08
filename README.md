<div align="center">
  <img src="/media/logo.png" width="475" />

[![Checks](https://github.com/Wildhoney/Chizu/actions/workflows/checks.yml/badge.svg)](https://github.com/Wildhoney/Chizu/actions/workflows/checks.yml)

</div>

Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

**[View Live Demo →](https://wildhoney.github.io/Chizu/)**

## Contents

1. [Benefits](#benefits)
1. [Getting started](#getting-started)
1. [Error handling](#error-handling)
1. [Model annotations](#model-annotations)
1. [Lifecycle actions](#lifecycle-actions)
1. [Distributed actions](#distributed-actions)
1. [Consuming actions](#consuming-actions)
1. [Stateful props](#stateful-props)
1. [Action middleware](#action-middleware)
1. [Real-time applications](#real-time-applications)
1. [Utility functions](#utility-functions)
1. [Referential equality](#referential-equality)
1. [Action regulator](#action-regulator)
1. [Context providers](#context-providers)

## Benefits

- Finely tuned and thoughtful event-driven architecture superset of [React](https://react.dev/).
- Super efficient with views only re-rendering when absolutely necessary.
- Built-in support for [optimistic updates](https://medium.com/@kyledeguzmanx/what-are-optimistic-updates-483662c3e171) within components.
- Mostly standard JavaScript without quirky rules and exceptions.
- Clear separation of concerns between business logic and markup.
- Strongly typed throughout &ndash; dispatches, models, etc&hellip;
- Easily communicate between actions using distributed actions.
- Bundled middleware for common action functionality such as supplant mode, reactive triggers, and polling.
- No need to worry about referential equality &ndash; reactive dependencies use checksum comparison.
- Built-in request cancellation with `AbortController` integration.
- Granular async state tracking per model field (pending, draft, operation type).
- Declarative lifecycle hooks without manual `useEffect` management.
- Centralised error handling for actions via the `Error` component.

## Getting started

Actions are responsible for mutating the state of the view. In the below example the `name` is dispatched from the view to the actions, the state is updated and the view is rendered with the updated value.

```tsx
import { useActions, Action } from "chizu";

type Model = {
  name: string | null;
};

const model: Model = {
  name: null,
};

export class Actions {
  static Name = Action<string>("Name");
}

export default function useNameActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Name, (context, name) => {
    context.actions.produce((draft) => {
      draft.model.name = name;
    });
  });

  return actions;
}
```

```tsx
export default function Profile(): React.ReactElement {
  const [model, actions] = useNameActions();

  return (
    <>
      <p>Hey {model.name}</p>

      <button onClick={() => actions.dispatch(Actions.Name, randomName())}>
        Switch profile
      </button>
    </>
  );
}
```

Notice `Action<string>("Name")` takes a generic to specify the payload type. The `actions.useAction` method registers handlers directly with the `useActions` scope &ndash; types are pre-baked from the `useActions<Model, typeof Actions>` call, so payload types are automatically inferred:

```tsx
export class Actions {
  static Name = Action<string>("Name");
}

export default function useNameActions() {
  const actions = useActions<Model, typeof Actions>(model);

  // The payload is automatically typed as `string` from the action definition
  actions.useAction(Actions.Name, (context, payload) => {
    // payload is correctly typed as `string`
  });

  return actions;
}
```

You can perform asynchronous operations in the action which will cause the associated view to render a second time:

```tsx
import { useActions, Action } from "chizu";

type Model = {
  name: string | null;
};

const model: Model = {
  name: null,
};

export class Actions {
  static Name = Action("Name");
}

export default function useNameActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Name, async (context) => {
    context.actions.produce((draft) => {
      draft.model.name = null;
    });

    const name = await fetch(/* ... */);

    context.actions.produce((draft) => {
      draft.model.name = name;
    });
  });

  return actions;
}
```

```tsx
export default function Profile(): React.ReactElement {
  const [model, actions] = useNameActions();

  return (
    <>
      <p>Hey {model.name}</p>

      <button onClick={() => actions.dispatch(Actions.Name)}>
        Switch profile
      </button>
    </>
  );
}
```

## Error handling

Chizu provides a simple way to catch errors that occur within your actions. Use the `Error` component to wrap your application and provide an error handler. The handler receives an `ErrorDetails` object containing information about the error:

```tsx
import { Error, Reason } from "chizu";

function App(): ReactElement {
  return (
    <Error
      handler={({ reason, error, action }) => {
        switch (reason) {
          case Reason.Timedout:
            console.warn(`Action "${action}" timed out:`, error.message);
            break;
          case Reason.Supplanted:
            console.info(`Action "${action}" was supplanted`);
            break;
          case Reason.Errored:
            console.error(`Action "${action}" failed:`, error.message);
            break;
        }
      }}
    >
      <Profile />
    </Error>
  );
}
```

The `ErrorDetails` object contains:

- **`reason`** &ndash; One of `Reason.Timedout` (action exceeded timeout set via `Use.Timeout()`), `Reason.Supplanted` (action was cancelled, e.g., by `Use.Supplant()`), `Reason.Disallowed` (action was blocked by the regulator), or `Reason.Errored` (a generic error thrown in your action handler).
- **`error`** &ndash; The `Error` object that was thrown.
- **`action`** &ndash; The name of the action that caused the error (e.g., `"Increment"`).
- **`handled`** &ndash; Whether the error was handled locally via `Lifecycle.Error`. Use this in the global `<Error>` handler to avoid duplicate handling.

### Custom error types

The `Error` component accepts an optional generic type parameter to include custom error classes in the handler's error type &mdash; custom error types must extend the base `Error` class:

```tsx
function App(): ReactElement {
  return (
    <Error<ApiError | ValidationError>
      handler={({ error }) => {
        if (error instanceof ApiError) {
          console.error(`API error ${error.statusCode}: ${error.message}`);
        } else if (error instanceof ValidationError) {
          console.error(`Validation failed: ${error.field} - ${error.message}`);
        } else {
          console.error(`Unknown error: ${error.message}`);
        }
      }}
    >
      <Profile />
    </Error>
  );
}
```

**Note:** For the `action` name to be meaningful, pass a name when creating actions:

```ts
export class Actions {
  static Increment = Action("Increment");
  static Decrement = Action("Decrement");
}
```

### Philosophy

Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. `Lifecycle.Error` handles errors **locally** where they occurred, allowing component-specific error recovery or UI updates.

## Model annotations

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

## Lifecycle actions

Chizu provides lifecycle actions that trigger at specific points in a component's lifecycle. Import `Lifecycle` from Chizu and bind handlers using `actions.useAction`:

```ts
import { useActions, Lifecycle } from "chizu";

export function useMyActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Lifecycle.Mount, (context) => {
    // Setup logic when component mounts
  });

  actions.useAction(Lifecycle.Unmount, (context) => {
    // Cleanup logic when component unmounts
  });

  actions.useAction(Lifecycle.Error, (context, error) => {
    // Handle errors from other actions
  });

  return actions;
}
```

- **`Lifecycle.Mount`** &ndash; Triggered once when the component mounts (`useLayoutEffect`).
- **`Lifecycle.Node`** &ndash; Triggered after the component renders (`useEffect`).
- **`Lifecycle.Error`** &ndash; Triggered when an action throws an error. Receives `ErrorDetails` as payload.
- **`Lifecycle.Unmount`** &ndash; Triggered when the component unmounts. All in-flight actions are automatically aborted before this handler runs.

**Note:** Actions should ideally be self-contained and handle expected errors internally using patterns like [Option](https://mobily.github.io/ts-belt/api/option) or [Result](https://mobily.github.io/ts-belt/api/result) types to update the model accordingly. `Lifecycle.Error` is intended for timeouts, aborts, and uncaught catastrophic errors &ndash; not routine error handling.

The `<Error>` component is a catch-all for errors from **any** action in your application, useful for global error reporting or logging. `Lifecycle.Error` handles errors **locally** where they occurred, allowing component-specific error recovery or UI updates.

## Distributed actions

Distributed actions allow different components to communicate with each other. Unlike regular actions which are scoped to a single component, distributed actions are broadcast to all mounted components that have defined a handler for them.

To create a distributed action, use `Distribution.Broadcast` as the first parameter. A good pattern is to define distributed actions in a shared class that other action classes can extend:

```ts
import { Action, Distribution } from "chizu";

export class DistributedActions {
  static SignedOut = Action(Distribution.Broadcast, "SignedOut");
}

export class Actions extends DistributedActions {
  static Increment = Action("Increment");
}
```

Distributed actions return a `DistributedPayload<T>` type, which is distinct from the `Payload<T>` returned by unicast actions. This enables compile-time enforcement &ndash; only distributed actions can be passed to `actions.consume()`.

Any component that defines a handler for `DistributedActions.SignedOut` will receive the action when it's dispatched from any other component. For direct access to the broadcast emitter, use `useBroadcast()`:

```ts
import { useBroadcast } from "chizu";

const broadcast = useBroadcast();

// Emit a distributed action
broadcast.emit(DistributedActions.SignedOut, payload);

// Listen for a distributed action
broadcast.on(DistributedActions.SignedOut, (payload) => {
  // Handle the action...
});
```

## Consuming actions

The `consume()` method subscribes to a distributed action and re-renders content whenever a new value is dispatched, making it ideal for global context scenarios where you want to fetch data once and access it throughout your app without prop drilling. The callback receives a `Box<T>` from [Immertation](https://github.com/Wildhoney/Immertation) containing the `value` and an `inspect` proxy for checking annotation status.

```tsx
export default function Visitor(): React.ReactElement {
  const [model, actions] = useVisitorActions();

  return (
    <div>
      {actions.consume(Actions.Visitor, (visitor) =>
        visitor.inspect.pending() ? <>Loading&hellip;</> : visitor.value.name,
      )}
    </div>
  );
}
```

> **Important:** The `consume()` method only accepts distributed actions created with `Distribution.Broadcast`. Attempting to pass a local (unicast) action will result in a TypeScript error. This is enforced at compile-time to prevent confusion &ndash; local actions are scoped to a single component and cannot be consumed across the application.

> **Note:** When a component mounts, `consume()` displays the most recent value for that action, even if it was dispatched before the component mounted. This is managed by the `Consumer` context provider. If no value has been dispatched yet, `consume()` renders `null` until the first dispatch occurs.

## Stateful props

Chizu uses the `Box<T>` type from [Immertation](https://github.com/Wildhoney/Immertation) to wrap values with metadata about their async state. Passing `Box<T>` to React components allows them to observe an object's state &ndash; checking if a value is pending, how many operations are in flight, and what the optimistic draft value is &ndash; all without additional state management.

The `Box<T>` type has two properties:

- **`box.value`** &ndash; The payload (e.g., `Country` object with `name`, `flag`, etc.).
- **`box.inspect`** &ndash; An `Inspect<T>` proxy for checking annotation status:
  - `box.inspect.pending()` &ndash; Returns `true` if any pending annotations exist.
  - `box.inspect.remaining()` &ndash; Returns the count of pending annotations.
  - `box.inspect.draft()` &ndash; Returns the draft value from the latest annotation.
  - `box.inspect.is(Op.Update)` &ndash; Checks if the annotation matches a specific operation.

## Action middleware

Chizu provides middleware for adding common behaviors to action handlers. Pass middleware as additional arguments after the handler:

```ts
import { useActions, Use } from "chizu";

export function useSearchActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(
    Actions.Search,
    async (context, query) => {
      const results = await fetch(`/search?q=${query}`, {
        signal: context.signal,
      });
      // ...
    },
    Use.Debounce(300), // Wait 300ms after last call
    Use.Supplant(), // Cancel previous in-flight request
  );

  return actions;
}
```

### Available middleware

| Middleware                            | Description                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Use.Supplant()`                      | Cancels the previous in-flight handler when a new dispatch arrives. Useful for search inputs where only the latest request matters. |
| `Use.Debounce(ms)`                    | Delays execution until no new dispatches occur for the specified duration. The timer resets on each call.                           |
| `Use.Throttle(ms)`                    | Limits execution to at most once per time window. First call executes immediately, subsequent calls during cooldown are queued.     |
| `Use.Retry(intervals)`                | Retries failed handlers with configurable delays. Defaults to exponential backoff `[1000, 2000, 4000]`. Respects the abort signal.  |
| `Use.Timeout(ms)`                     | Aborts the handler if it exceeds the specified duration. Triggers the abort signal for graceful cleanup.                            |
| `Use.Reactive(getDeps, getPayload)`   | Auto-triggers when primitive dependencies change. Uses checksum comparison for change detection.                                    |
| `Use.Poll(ms, getPayload, getStatus)` | Auto-triggers at regular intervals. Supports pause/play via `getStatus` returning `Status.Pause` or `Status.Play`.                  |

### Combining middleware

Middleware are applied in order (first middleware is outermost). This matters for certain combinations:

```ts
actions.useAction(
  Actions.Fetch,
  async (context, id) => {
    const data = await fetch(`/api/${id}`, { signal: context.signal });
    return data.json();
  },
  Use.Supplant(), // 1. Cancel previous request
  Use.Retry([500, 1000]), // 2. Retry on failure
  Use.Timeout(5000), // 3. Abort if too slow
);
```

In this example:

1. `Use.Supplant()` wraps everything, so a new dispatch cancels the entire retry sequence
2. `Use.Retry()` wraps the timeout, so each retry attempt has its own 5s limit
3. `Use.Timeout()` applies to the handler directly

### Examples

**Search with debounce and supplant:**

```ts
actions.useAction(
  Actions.Search,
  async (context, query) => {
    const results = await fetch(`/search?q=${query}`, {
      signal: context.signal,
    });
    context.actions.produce((draft) => {
      draft.model.results = await results.json();
    });
  },
  Use.Debounce(300),
  Use.Supplant(),
);
```

**API call with retry and timeout:**

```ts
actions.useAction(
  Actions.FetchData,
  async (context, id) => {
    const response = await fetch(`/api/data/${id}`, {
      signal: context.signal,
    });
    if (!response.ok) throw new Error("Failed to fetch");
    // ...
  },
  Use.Retry([1000, 2000, 4000]),
  Use.Timeout(10000),
);
```

**Scroll handler with throttle:**

```ts
actions.useAction(
  Actions.Scroll,
  (context, position) => {
    context.actions.produce((draft) => {
      draft.model.scrollPosition = position;
    });
  },
  Use.Throttle(100),
);
```

**Auto-trigger on dependency change:**

```ts
actions.useAction(
  Actions.Search,
  async (context, query) => {
    const results = await fetch(`/search?q=${query}`);
    context.actions.produce((draft) => {
      draft.model.results = await results.json();
    });
  },
  Use.Reactive(
    (ctx) => [ctx.model.searchTerm],
    (ctx) => ctx.model.searchTerm,
  ),
  Use.Supplant(),
);
```

**Polling with pause control:**

```ts
actions.useAction(
  Actions.Refresh,
  async (context) => {
    const data = await fetch("/api/data");
    context.actions.produce((draft) => {
      draft.model.data = await data.json();
    });
  },
  Use.Poll(5000, undefined, (ctx) =>
    ctx.model.isPaused ? Status.Pause : Status.Play,
  ),
);
```

## Action control patterns

While [middleware](#action-middleware) provides a declarative approach, you can also implement these patterns manually using `context.signal` and standard JavaScript:

### Cancellation with `context.signal`

Every action receives an `AbortSignal` via `context.signal`. Use it to cancel in-flight requests when the component unmounts or when actions are aborted:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  const response = await fetch(`/search?q=${query}`, {
    signal: context.signal,
  });
  // ...
});
```

### Timeouts

Implement timeouts using `AbortSignal.timeout()` combined with `context.signal`:

```ts
actions.useAction(Actions.FetchData, async (context) => {
  const response = await fetch("/api/data", {
    signal: AbortSignal.any([context.signal, AbortSignal.timeout(5_000)]),
  });
  // ...
});
```

### Retry logic

Implement retries with a simple loop:

```ts
actions.useAction(Actions.FetchData, async (context) => {
  const intervals = [1_000, 2_000, 4_000];
  let lastError: Error | null = null;

  for (const delay of [0, ...intervals]) {
    if (delay > 0) await utils.sleep(delay, context.signal);
    try {
      const response = await fetch("/api/data", { signal: context.signal });
      return await response.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError;
});
```

### Debouncing and throttling

For debounced inputs, use `context.regulator.abort.self()` to cancel previous instances:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  await utils.sleep(300, context.signal); // Debounce delay
  const results = await fetch(`/search?q=${query}`, { signal: context.signal });
  // ...
});
```

Dispatch the action on every keystroke &ndash; the sleep will be aborted when a new dispatch occurs, effectively debouncing the search.

## Real-time applications

Chizu's lifecycle actions make it easy to integrate with real-time data sources like Server-Sent Events (SSE), WebSockets, or any event-based API. Use `Lifecycle.Mount` to establish connections and `Lifecycle.Unmount` to clean them up.

Here's an example that tracks website visitors in real-time using SSE:

```ts
import { useActions, Lifecycle, Action } from "chizu";

type Country = { name: string; flag: string; timestamp: number };

type Model = {
  visitor: Country | null;
  history: Country[];
  source: EventSource | null;
};

export class Actions {
  static Visitor = Action<Country>("Visitor");
}

const model: Model = {
  visitor: null,
  history: [],
  source: null,
};

export function useVisitorActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Lifecycle.Mount, (context) => {
    const source = new EventSource("/visitors");
    source.addEventListener("visitor", (event) => {
      context.actions.dispatch(
        Actions.Visitor,
        JSON.parse(event.data) as Country,
      );
    });
    context.actions.produce((draft) => {
      draft.model.source = source;
    });
  });

  actions.useAction(Actions.Visitor, (context, country) => {
    context.actions.produce((draft) => {
      draft.model.visitor = country;
      draft.model.history = [country, ...draft.model.history].slice(0, 20);
    });
  });

  actions.useAction(Lifecycle.Unmount, (context) => {
    context.model.source?.close();
  });

  return actions;
}
```

Key patterns demonstrated:

- **Connection in `Lifecycle.Mount`** &ndash; Establish the SSE connection when the component mounts, storing the `EventSource` in the model for later cleanup.
- **Event-driven dispatches** &ndash; When SSE events arrive, dispatch actions to update the model, triggering efficient re-renders.
- **Cleanup in `Lifecycle.Unmount`** &ndash; Close the connection when the component unmounts to prevent memory leaks.
- **All handlers use `actions.useAction`** &ndash; Lifecycle handlers benefit from the same `useEffectEvent` wrapper as regular actions, with types pre-baked from the `useActions` call.

See the full implementation in the [Visitor example source code](https://github.com/Wildhoney/Chizu/blob/main/src/example/visitor/actions.ts).

## Utility functions

Chizu provides a set of utility functions via the `utils` namespace to help with common patterns. Each utility also has a shorthand Greek letter alias for concise code.

```ts
import { utils } from "chizu";
```

### `utils.set(property)` / `utils.λ`

Creates a generic setter action that updates a specific property in the state. Useful for simple state updates without writing a full action handler:

```ts
class {
  [Actions.Name] = utils.set("name");
  // or using the alias:
  [Actions.Name] = utils.λ("name");
}
```

### `utils.pk()` / `utils.κ`

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

### `utils.checksum(value)` / `utils.Σ`

Generates a deterministic hash string from any value. Returns `null` if the value cannot be serialised (e.g., circular references). Useful for creating cache keys, comparing object equality, or tracking changes:

```ts
const hash = utils.checksum({ userId: 123, filters: { active: true } });
// Returns a stable hash string like "1a2b3c4d"

// Use for cache keys or change detection
if (utils.checksum(currentData) !== utils.checksum(previousData)) {
  // Data has changed...
}
```

**Note:** The `Use.Reactive()` middleware uses checksum internally for `getDependencies`, so you don't need to manually track changes.

### `utils.sleep(ms, signal?)` / `utils.ζ`

Returns a promise that resolves after the specified milliseconds. Useful for simulating delays in actions during development or adding intentional pauses. Optionally accepts an `AbortSignal` to cancel the sleep early:

```ts
const fetch = useAction<Action, "Fetch">(async (context) => {
  await utils.sleep(1_000); // Simulate network delay
  const data = await fetch("/api/data", { signal: context.signal });
  // ...
});
```

## Referential equality

Chizu uses [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) internally, so action handlers in `actions.useAction` always access the latest values from closures without needing to re-create the handler. This means you don't need to worry about stale closures in most cases.

However, in async actions where you `await` I/O operations, there's a rare edge case: if a closure reference changes while the await is in progress, you may access a stale value after the await. For these situations, use `useSnapshot`:

```ts
import { useActions, useSnapshot } from "chizu";

function useSearchActions(props: Props) {
  const actions = useActions<Model, typeof Actions>(model);
  const snapshot = useSnapshot(props);

  actions.useAction(Actions.Search, async (context, query) => {
    // Before await: props.filters is current (useEffectEvent-like behavior)
    console.log(props.filters);

    const results = await fetch(`/search?q=${query}`);

    // After await: props.filters might be stale if it changed during the fetch
    // Use snapshot.filters instead for guaranteed latest value
    console.log(snapshot.filters);
  });

  return actions;
}
```

`useSnapshot` creates a proxy object where property access always returns the latest value from a ref that updates on every render. Use it when you need to access props or external values after an await in async actions.

## Action regulator

The regulator is accessed via `context.regulator` inside your action handlers. It provides fine-grained control over asynchronous actions by managing `AbortController` instances and action policies. You can programmatically allow or disallow actions, and abort running actions across all components in the context.

### Usage

```ts
actions.useAction(Actions.Fetch, async (context) => {
  // Disallow future dispatches of these actions
  context.regulator.policy.disallow.matching([Actions.Fetch, Actions.Save]);

  // Future dispatches via actions.useAction will be aborted immediately
  // and the error handler will receive Reason.Disallowed
});

actions.useAction(Actions.Reset, async (context) => {
  // Allow the actions again
  context.regulator.policy.allow.matching([Actions.Fetch, Actions.Save]);
});
```

You can also abort running actions:

```ts
// Abort specific actions across all components
context.regulator.abort.matching([Actions.Fetch]);

// Abort all actions across all components
context.regulator.abort.all();

// Abort only the current action instance
context.regulator.abort.self();
```

### API

**Abort methods:**

- `abort.all()` — Aborts all running actions across all components in the context.
- `abort.matching(actions)` — Aborts specific actions (array) across all components.
- `abort.self()` — Aborts only the current action instance.
- `abort.own()` — Aborts all actions belonging to the current component only (called automatically on unmount).

**Allow methods:**

- `policy.allow.all()` — Clears all disallow policies across all components.
- `policy.allow.matching(actions)` — Allows specific actions (array) across all components.
- `policy.allow.self()` — Allows the current action.
- `policy.allow.own()` — Clears all disallow policies belonging to the current component only.

**Disallow methods:**

- `policy.disallow.all()` — Clears all allow policies across all components.
- `policy.disallow.matching(actions)` — Disallows specific actions (array) across all components.
- `policy.disallow.self()` — Disallows the current action.
- `policy.disallow.own()` — Clears all allow policies belonging to the current component only.

The regulator is useful for advanced scenarios where you need to centrally manage cancellation and permission of asynchronous actions, such as rate limiting, feature toggling, or global aborts.

## Context providers

Chizu provides context providers for advanced use cases where you need isolated contexts. These are edge cases &ndash; most applications don't need them.

### `Broadcaster`

Creates an isolated broadcast context for distributed actions. Useful for libraries that want their own broadcast context without interfering with the host application:

```tsx
import { Broadcaster } from "chizu";

function MyLibraryRoot({ children }) {
  return <Broadcaster>{children}</Broadcaster>;
}
```

Components inside `<Broadcaster>` have their own isolated broadcast channel. Distributed actions dispatched inside won't reach components outside, and vice versa.

### `Regulators`

Creates an isolated regulator context. All regulator operations (`abort.all()`, `policy.disallow.matching()`, etc.) only affect components within the same `Regulators` provider:

```tsx
import { Regulators } from "chizu";

function Example({ children }) {
  return <Regulators>{children}</Regulators>;
}
```

This is useful for libraries that need action control without affecting the host application's actions. An `abort.all()` inside the provider won't abort actions outside it.

### `Consumer`

Creates an isolated consumer context for storing distributed action values. The Consumer stores the latest payload for each distributed action, enabling the `consume()` method to display the most recent value even when components mount after the action was dispatched:

```tsx
import { Consumer } from "chizu";

function MyLibraryRoot({ children }) {
  return <Consumer>{children}</Consumer>;
}
```

Components inside `<Consumer>` have their own isolated value store. Actions consumed inside won't see values dispatched outside, and vice versa. This is useful for libraries that want to use `consume()` without interfering with the host application's consumed values.

**Note:** In most applications, you don't need to provide a `Consumer` &ndash; one is created automatically at the default context level. Only use `<Consumer>` when you need isolation for library boundaries or testing.
