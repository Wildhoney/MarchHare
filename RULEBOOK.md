# Chizu Rulebook

This document defines the rules and conventions for the Chizu framework—a strongly typed, event-driven React state management library.

---

## Core Philosophy

1. **Views re-render only when the model changes** — granular state tracking eliminates unnecessary renders
2. **Type safety at compile time** — branded types and phantom types enforce correctness before runtime
3. **Declarative lifecycles** — use action handlers instead of `useEffect`
4. **Immutable state updates** — all mutations go through `produce()` via Immertation

---

## Actions

### Rule 1: Define actions as static class members

```ts
class Actions {
  static Increment = Action<number>("Increment");
  static Reset = Action("Reset"); // void payload
}
```

### Rule 2: Use `Distribution.Broadcast` for cross-component communication

```ts
class DistributedActions {
  static UserUpdated = Action<User>("UserUpdated", Distribution.Broadcast);
}
```

Unicast actions are local to the component. Broadcast actions propagate to all consumers.

### Rule 3: Never mix unicast and broadcast in the same class without inheritance

```ts
// Correct: extend for mixed usage
class AppActions extends DistributedActions {
  static LocalFetch = Action<Query>("LocalFetch");
}
```

### Rule 4: Action names must be unique within their scope

The framework uses symbol descriptions for identification. Duplicate names cause handler collisions.

---

## State Updates

### Rule 5: Always use `produce()` for state mutations

```ts
context.actions.produce((draft) => {
  draft.model.count = 42;
});
```

Never mutate the model directly outside of `produce()`.

### Rule 6: Use annotations for trackable state changes

```ts
context.actions.produce((draft) => {
  draft.model.data = context.actions.annotate(Op.Update, newValue);
});
```

Annotations enable `inspect.pending()`, `inspect.settled()`, etc.

### Rule 7: Nested `produce()` calls are allowed

Immertation handles merging. Use this for conditional updates within handlers.

```ts
actions.useAction(Actions.Fetch, async (context) => {
  context.actions.produce((draft) => {
    draft.model.status = "loading";
  });

  const data = await fetchData();

  context.actions.produce((draft) => {
    draft.model.data = data;
    draft.model.status = "success";
  });
});
```

---

## Handlers

### Rule 8: Three handler signatures are supported

**Synchronous:**

```ts
actions.useAction(Actions.Set, (context, payload) => {
  context.actions.produce((draft) => {
    draft.model.value = payload;
  });
});
```

**Asynchronous:**

```ts
actions.useAction(Actions.Fetch, async (context, query) => {
  const data = await fetch(`/api?q=${query}`);
  context.actions.produce((draft) => {
    draft.model.data = data;
  });
});
```

**Generator:**

```ts
actions.useAction(Actions.Stream, function* (context) {
  for (const item of items) {
    yield processItem(item);
  }
});
```

### Rule 9: Use `With()` for simple property assignments

```ts
actions.useAction(Actions.SetName, With("name"));
// Equivalent to: (context, payload) => draft.model.name = payload
```

The payload type must match the property type.

### Rule 10: Use filtered actions for targeted event delivery

Instead of filtering inside handlers, subscribe with a filter object:

```ts
// Subscribe to updates for a specific user ID
actions.useAction(
  [Actions.UserUpdated, { UserId: props.userId }],
  (context, user) => {
    context.actions.produce((draft) => {
      draft.model.user = user;
    });
  },
);
```

Dispatching with a filter only triggers handlers where the filter matches:

```ts
// Only handlers with matching UserId fire
actions.dispatch([Actions.UserUpdated, { UserId: user.id }], user);
```

Dispatching to the plain action triggers ALL handlers (plain + all filtered):

```ts
// All handlers fire: plain handlers AND all filtered handlers
actions.dispatch(Actions.UserUpdated, user);
```

Filter values must be non-nullable primitives: `string`, `number`, `boolean`, or `symbol`. By convention, use uppercase keys like `{UserId: 4}` to distinguish filter keys from payload properties.

### Rule 11: Extract handlers for testability using `HandlerMap`

Define handlers as standalone functions for easier unit testing. Use `HandlerMap` — a Higher-Kinded Type (HKT) emulation that creates a mapped type where each action key maps to its handler type.

TypeScript doesn't natively support HKTs (types that return types), but `HandlerMap` emulates them using mapped types with indexed access.

```ts
import { Action, HandlerMap } from "chizu";

class Actions {
  static SetName = Action<string>("SetName");
  static SetAge = Action<number>("SetAge");
}

// Define the HKT once for this module
type H = HandlerMap<Model, typeof Actions>;

// "Apply" the HKT via indexed access — H["SetName"] is the handler type
export const handleSetName: H["SetName"] = (context, name) => {
  context.actions.produce((draft) => {
    draft.model.name = name;
  });
};

export const handleSetAge: H["SetAge"] = (context, age) => {
  context.actions.produce((draft) => {
    draft.model.age = age;
  });
};

// Reference in component
function useUserActions() {
  const actions = useActions<Model, typeof Actions>(model);
  actions.useAction(Actions.SetName, handleSetName);
  actions.useAction(Actions.SetAge, handleSetAge);
  return actions;
}
```

The `HandlerMap` type parameters are:

| Parameter | Description                                    |
| --------- | ---------------------------------------------- |
| `M`       | The model type                                 |
| `AC`      | The actions class type (`typeof Actions`)      |
| `D`       | Optional data/props type (defaults to `Props`) |

Access individual handler types via indexed access: `H["ActionName"]`.

### Rule 12: Access external values via `context.data` after await

```ts
const actions = useActions(model, () => ({ userId: props.userId }));

actions.useAction(Actions.Fetch, async (context) => {
  await someAsyncWork();
  // props.userId might be stale here, but context.data.userId is fresh
  console.log(context.data.userId);
});
```

Closures capture values at dispatch time. `context.data` provides reactive access.

---

## Lifecycles

### Rule 13: Use lifecycle actions instead of `useEffect`

```ts
actions.useAction(Lifecycle.Mount, (context) => {
  // Setup logic — runs once on mount
});

actions.useAction(Lifecycle.Unmount, (context) => {
  // Cleanup logic — runs on unmount
});

actions.useAction(Lifecycle.Node, (context) => {
  // Runs after every render (like useEffect with no deps)
});

actions.useAction(Lifecycle.Error, (context, fault) => {
  // Local error handling
});
```

### Rule 14: Understand the Phase context

- `Phase.Mounting` — component is mounting
- `Phase.Mounted` — component is fully mounted and operational
- `Phase.Unmounting` — cleanup in progress
- `Phase.Unmounted` — component is unmounted

Access via `context.phase` to conditionally handle actions.

```ts
actions.useAction(DistributedActions.UserUpdated, (context, user) => {
  if (context.phase === Phase.Mounting) {
    // Hydrating from cache — just update state silently
    context.actions.produce((draft) => {
      draft.model.user = user;
    });
    return;
  }

  // Live update — show notification
  context.actions.produce((draft) => {
    draft.model.user = user;
    draft.model.notification = "User profile updated";
  });
});
```

### Rule 15: Mounting phase delivers cached and lifecycle actions

During mount, handlers receive actions with `Phase.Mounting`:

- **Lifecycle actions** (`Lifecycle.Mount`) are called with `Phase.Mounting`
- **Cached distributed actions** (dispatched before this component mounted) are replayed with `Phase.Mounting`

After mount completes, all subsequent dispatches arrive with `Phase.Mounted`.

```ts
actions.useAction(DistributedActions.Data, (context, payload) => {
  if (context.phase === Phase.Mounting) {
    // This is a cached value from before we mounted
    // or this is the initial lifecycle call
  } else {
    // This is a fresh dispatch that happened after mount
  }
});
```

This enables components to distinguish between hydration and live updates.

---

## Distributed Actions

### Rule 16: Only broadcast actions can be consumed

```tsx
class Actions {
  static Broadcast = Action<Data>("Broadcast", Distribution.Broadcast);
  static Unicast = Action<Data>("Unicast");
}

actions.consume(Actions.Broadcast, (box) => <div>{box.value}</div>); // Valid
actions.consume(Actions.Unicast, (box) => <div>{box.value}</div>); // Type error
```

### Rule 17: Use `consume()` for reactive UI from broadcast actions

```tsx
actions.consume(Actions.UserLoggedIn, (box) => (
  <span>Welcome, {box.value.name}!</span>
));
```

The `consume()` method creates a reactive UI element that:

- Renders `null` until the action is first dispatched
- Re-renders automatically when new payloads arrive
- Provides a `Box<T>` with `.value` (the payload) and `.inspect` (for annotations)

```tsx
// Access the payload and check annotations
actions.consume(Actions.Data, (box) => (
  <div className={box.inspect.pending() ? "loading" : ""}>
    {box.value.content}
  </div>
));
```

### Rule 18: Late-mounting components receive cached values

When a component mounts after a broadcast, it automatically receives the last emitted value during `Phase.Mounting`.

```tsx
// Component A dispatches a broadcast action
actions.dispatch(Actions.UserLoggedIn, user);

// Later, Component B mounts — its handler receives the cached value
actions.useAction(Actions.UserLoggedIn, (context, user) => {
  // context.phase === Phase.Mounting (hydrating from cache)
  context.actions.produce((draft) => {
    draft.model.currentUser = user;
  });
});
```

### Rule 19: Use filtered actions for targeted broadcast delivery

Use filtered actions to prevent unnecessary handler execution across components.

```ts
// Without filter — every component with this handler executes
actions.useAction(Actions.UserUpdated, (context, user) => {
  // Runs for ALL UserUpdated dispatches
});

// With filter — only executes when the filter matches
actions.useAction(
  [Actions.UserUpdated, { UserId: context.data.userId }],
  (context, user) => {
    // Only runs when dispatched with matching filter
  },
);
```

Dispatch with a filter when you only want targeted handlers to fire:

```ts
// Only handlers with matching UserId fire
actions.dispatch([Actions.UserUpdated, { UserId: user.id }], user);

// All handlers fire (plain + all filtered)
actions.dispatch(Actions.UserUpdated, user);
```

---

## Task Management

### Rule 20: Use the abort signal for cancellation

```ts
actions.useAction(Actions.Fetch, async (context) => {
  const response = await fetch(url, {
    signal: context.task.controller.signal,
  });
});
```

### Rule 21: Cancel competing tasks explicitly <!-- TODO: needs more work -->

```ts
// Abort all other tasks for this action
for (const task of context.tasks) {
  if (task !== context.task) {
    task.controller.abort();
  }
}
```

### Rule 22: In-flight tasks auto-abort on unmount

No manual cleanup required for pending async work.

---

## Error Handling

### Rule 23: Use `Lifecycle.Error` for local error recovery

```ts
actions.useAction(Lifecycle.Error, (context, fault) => {
  if (fault.reason === Reason.Timedout) {
    // Retry logic
  }
});
```

### Rule 24: Use the `<Error>` boundary for global error handling

```tsx
<Error
  handler={({ reason, error, action }) => {
    reportToService(error);
  }}
>
  <App />
</Error>
```

### Rule 25: Know the error reasons <!-- TODO: needs more work -->

- `Reason.Timedout` — action exceeded timeout
- `Reason.Supplanted` — newer dispatch cancelled this one
- `Reason.Disallowed` — blocked by regulator
- `Reason.Errored` — exception thrown
- `Reason.Unmounted` — component unmounted during execution

### Rule 26: Use `Option` or `Result` for fallible model properties

For API data or other fallible values, use [ts-belt](https://mobily.github.io/ts-belt/) `Option` or `Result` types instead of separate `isError` flags. This keeps fallibility colocated with the data.

```ts
import { O, R } from "@mobily/ts-belt";

// Bad: separate error state
type Model = {
  user: User | null;
  userError: Error | null;
  isUserLoading: boolean;
};

// Good: colocated fallibility with Option
type Model = {
  user: O.Option<User>; // None | Some<User>
};

// Good: colocated fallibility with Result (when you need the error)
type Model = {
  user: R.Result<User, Error>; // Error<E> | Ok<T>
};
```

Usage in handlers:

```ts
import { O, R } from "@mobily/ts-belt";

actions.useAction(Actions.FetchUser, async (context) => {
  try {
    const user = await api.fetchUser();
    context.actions.produce((draft) => {
      draft.model.user = O.Some(user);
      // or with Result: R.Ok(user)
    });
  } catch (error) {
    context.actions.produce((draft) => {
      draft.model.user = O.None;
      // or with Result: R.Error(error)
    });
  }
});
```

Usage in components:

```tsx
import { O, pipe } from "@mobily/ts-belt";

// Pattern match on the Option
{
  pipe(
    model.user,
    O.match(
      (user) => <UserProfile user={user} />,
      () => <EmptyState />,
    ),
  );
}
```

Benefits:

- **Colocated state** — No separate `isError`, `isLoading` booleans to synchronize
- **Exhaustive handling** — TypeScript enforces you handle both success and failure cases
- **Composable** — Chain operations with `map`, `flatMap`, `getWithDefault`, etc.

---

## Type Safety

### Rule 27: Use `Pk<T>` for primary keys with optimistic updates

```ts
interface Todo {
  id: Pk<number>; // Can be symbol (temp) or number (concrete)
  text: string;
}

// Create with temporary symbol key for optimistic insert
const tempId = utils.pk();
context.actions.produce((draft) => {
  draft.model.todos.push({ id: tempId, text });
});

const response = await api.createTodo(text);

// Find by symbol key — indices may have changed from other actions
context.actions.produce((draft) => {
  const found = draft.model.todos.find((todo) => todo.id === tempId);
  if (found) found.id = response.id;
});
```

### Rule 28: Let TypeScript infer handler payload types

```ts
class Actions {
  static Increment = Action<number>("Increment");
}

// Payload type inferred from Action<number>
actions.useAction(Actions.Increment, (context, payload) => {
  // payload is number — no annotation needed
});
```

### Rule 29: Use `Op` to specify annotation operations

```ts
import { Op } from "chizu";

context.actions.produce((draft) => {
  draft.model.item = context.actions.annotate(Op.Update, newValue);
});
```

Available operations:

| Operation    | Value | Use Case           |
| ------------ | ----- | ------------------ |
| `Op.Add`     | 1     | Optimistic insert  |
| `Op.Remove`  | 2     | Optimistic delete  |
| `Op.Update`  | 4     | Optimistic update  |
| `Op.Move`    | 8     | Reordering items   |
| `Op.Replace` | 16    | Full replacement   |
| `Op.Sort`    | 32    | Sorting operations |

Annotations enable tracking pending operations and showing loading states.

### Rule 30: Use `inspect` to check annotation status

```ts
// Check if a property has pending annotations
const isPending = actions.inspect.user.pending();

// Check if annotation matches a specific operation
const isAdding = actions.inspect.todos[0].is(Op.Add);

// Get the draft value (annotation value or actual value)
const draftValue = actions.inspect.user.name.draft();

// Get count of pending annotations at a path
const remaining = actions.inspect.items.remaining();

// Wait for annotations to settle
const finalValue = await actions.inspect.user.settled();
```

The `inspect` proxy mirrors the model structure, providing methods at any path.

### Rule 31: Use `Box<T>` for passing reactive state slices

```ts
type Box<T> = {
  value: T; // The current value
  inspect: Inspect<T>; // Inspect proxy for this slice
};
```

A `Box` bundles a value with its inspection capabilities:

```tsx
function UserCard({ box }: { box: Box<User> }) {
  return (
    <div className={box.inspect.pending() ? "loading" : ""}>
      <h2>{box.value.name}</h2>
      <p>{box.value.email}</p>
    </div>
  );
}

// Parent passes a box slice
<UserCard box={actions.box((model) => model.user)} />;
```

Use `actions.box()` to create a `Box` from a model selector. The child receives both the value and the ability to inspect its annotations.

---

## Component Structure

### Rule 32: Use `<Boundary>` to isolate distributed actions

By default, broadcast actions propagate globally. Use `<Boundary>` to create isolated scopes where distributed actions don't leak outside.

```tsx
<Boundary>
  {/* Distributed actions here won't affect components outside */}
  <IsolatedFeature />
</Boundary>
```

### Rule 33: One `useActions` call per component

```ts
const [model, actions] = useActions<Model, typeof Actions>(initialModel);
```

Multiple calls create separate, unconnected state instances.

### Rule 34: Use `.box()` to pass slice state to child components

```tsx
<UserProfile box={actions.box((model) => model.user)} />
```

The child receives a `Box` with reactive access to that slice of state, including `inspect` for annotations.

### Rule 35: Use `.context()` to pass the entire context to child components

```tsx
<UserEditor context={actions.context()} />
```

The child receives the full context including `produce`, `dispatch`, and `annotate` — useful when children need to update state.

---

## Utilities

### Rule 36: Use `utils.sleep()` for delays with cancellation support

```ts
await utils.sleep(1000, context.task.controller.signal);
```

Respects the abort signal for clean cancellation.

### Rule 37: Use `utils.pk()` for optimistic update keys

```ts
const tempId = utils.pk(); // Symbol
const isConcrete = utils.pk(id); // boolean — true if not a symbol
```

### Rule 38: Prefer `ky` over React Query for HTTP requests

Chizu handles caching (via distributed actions), loading states (via `inspect`), and cancellation (via `context.task.controller`). React Query's caching layer is redundant. Use [ky](https://github.com/sindresorhus/ky) — a lightweight fetch wrapper.

```ts
import ky from "ky";

actions.useAction(Actions.FetchUser, async (context, userId) => {
  context.actions.produce((draft) => {
    draft.model.user = context.actions.annotate(Op.Update, draft.model.user);
  });

  const user = await ky
    .get(`/api/users/${userId}`, {
      signal: context.task.controller.signal,
    })
    .json<User>();

  context.actions.produce((draft) => {
    draft.model.user = user;
  });
});
```

Key benefits:

- **Automatic cancellation** — pass `context.task.controller.signal` to abort on unmount
- **No duplicate caching** — Chizu's distributed actions handle cross-component data sharing
- **Lightweight** — ky is ~3KB vs React Query's ~40KB
- **Typed responses** — `.json<T>()` provides type-safe parsing

See `recipes/ky-http-client.md` for advanced patterns (configured instances, error handling, hooks).

### Rule 39: Use distributed actions for SSE (Server-Sent Events)

Broadcast SSE events to all listening components using distributed actions. Connect on mount, dispatch broadcasts on message, and let Chizu handle cleanup.

```ts
class Actions {
  static PriceUpdate = Action<Price>("PriceUpdate", Distribution.Broadcast);
}

actions.useAction(Lifecycle.Mount, (context) => {
  const eventSource = new EventSource("/api/prices/stream");

  eventSource.addEventListener("message", (event) => {
    const price = JSON.parse(event.data) as Price;
    context.actions.dispatch(Actions.PriceUpdate, price);
  });

  eventSource.addEventListener("error", () => {
    eventSource.close();
  });

  // Cleanup on abort (unmount or supplant)
  context.task.controller.signal.addEventListener("abort", () => {
    eventSource.close();
  });
});
```

Consumers receive updates automatically:

```tsx
// Listen for updates to a specific symbol using filtered actions
actions.useAction(
  [Actions.PriceUpdate, { Symbol: context.data.symbol }],
  (context, price) => {
    context.actions.produce((draft) => {
      draft.model.currentPrice = price;
    });
  },
);

// Or render directly with consume()
actions.consume(Actions.PriceUpdate, (box) => (
  <span className="price">${box.value.amount}</span>
));
```

When dispatching, use a filter to target specific listeners:

```tsx
// Dispatch to specific symbol filter
context.actions.dispatch(
  [Actions.PriceUpdate, { Symbol: price.symbol }],
  price,
);
```

Late-mounting components receive the last cached value during `Phase.Mounting`.

---

## Anti-Patterns

### Don't use `useEffect` for Chizu patterns

```ts
// Wrong
useEffect(() => {
  fetchData();
}, []);

// Right
actions.useAction(Lifecycle.Mount, async (context) => {
  await fetchData();
});
```

### Don't mutate state outside `produce()` (TypeScript enforced)

```ts
// Wrong — TypeScript error: Cannot assign to 'count' because it is a read-only property
model.count = 5;

// Right
context.actions.produce((draft) => {
  draft.model.count = 5;
});
```

### Don't ignore the abort signal in async handlers

```ts
// Wrong
const data = await fetch(url);

// Right
const data = await fetch(url, { signal: context.task.controller.signal });
```

### Don't rely on closure values after await

```ts
// Wrong
const userId = props.userId;
await fetch();
console.log(userId); // Might be stale

// Right
await fetch();
console.log(context.data.userId); // Always fresh
```

---

## Summary

| Concept      | Rule                                             |
| ------------ | ------------------------------------------------ |
| Actions      | Static class members with `Action<T>()`          |
| Filters      | `[Action, { Key: value }]` for targeted delivery |
| Broadcast    | `Distribution.Broadcast` for cross-component     |
| State        | Always via `produce()`, use annotations          |
| Handlers     | Sync, async, or generator signatures             |
| Lifecycles   | `Mount`, `Unmount`, `Node`, `Error`              |
| Data access  | Use `context.data` after await                   |
| Cancellation | Use `context.task.controller.signal`             |
| Types        | Strict models, `Pk<T>` for optimistic keys       |
