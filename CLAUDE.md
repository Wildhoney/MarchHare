# March Hare AI Assistant Guide

Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

## Quick Reference

```ts
import {
  App,
  Action,
  Distribution,
  Lifecycle,
  With,
  utils,
  Cache,
  Boundary,
  Reason,
  Aborted,
  annotate,
  Operation,
  Op,
  State,
  shared,
} from "march-hare";
import type {
  Box,
  Fault,
  Handler,
  Handlers,
  Maybe,
  Pk,
  Tap,
  Taps,
} from "march-hare";
```

`shared.*` &mdash; standalone hooks/factories for reusable components: `shared.useContext`, `shared.useEnv`, `shared.Resource`, `shared.Scope`. Reach for `app.X` instead when you only need to support a single App. Persistent caches live on the App: `App({ cache })` is shared by every `app.Resource`. Both pieces of `Cache(config)` are optional and independent: pass `Cache({ ...adapter })` for a persistent cache, `Cache<E>({ key })` for an env-scoped in-memory cache, or `Cache<E>({ ...adapter, key })` for both. The adapter members are an all-or-nothing group &mdash; supplying a partial adapter is a type error. See [recipes/use-resource.md](./recipes/use-resource.md#per-context-scoping--cache-adapter-key).

## Core Concepts

March Hare is an event-driven state management library for React built on the publish-subscribe pattern. Key concepts:

- **Model:** The application state, a plain JavaScript object. Pass `void` for actions-only components with no local state.
- **Actions:** Typed events that trigger state changes. Created with `Action<Payload>("name")`.
- **`useActions` hook:** Returns `[model, actions]` tuple with pre-typed methods. Use `useActions<void, typeof Actions>()` when no model is needed.
- **`actions.useAction`:** Registers handlers for actions. Receives `context` and `payload`.
- **`context.actions.produce`:** Immutable state updates via Immer/Immertation. Receives `{ model, inspect }`.
- **`context.data`:** Reactive external values (props, context) that stay fresh after `await`.

### Basic Example

```tsx
import { useActions, Action, With } from "march-hare";

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
import { Action, Distribution } from "march-hare";

// Unicast (default) - only the dispatching component handles it
static Increment = Action("Increment");
static SetCount = Action<number>("SetCount");

// Broadcast - all mounted components receive it
static UserUpdated = Action<User>("UserUpdated", Distribution.Broadcast);

// Multicast - components inside the matching withScope boundary receive it
static Update = Action<number>("Update", Distribution.Multicast);

// Omnicast - broadcast locally AND carried to every other connected client
// over SSE when the App is configured with `sse`; payload type inferred from
// the Zod-style schema, which validates incoming envelopes at runtime
static Adopted = Action("Cat.Adopted", Distribution.Omnicast(Payload.Adoption));
static Opened = Action("Cattery.Opened", Distribution.Omnicast());
```

Omnicast setup: `App({ sse: { url, actions: Omnicast, tags? } })` &mdash; the Boundary auto-manages the connection (connect/disconnect/reconnect); `sse.actions` is the incoming allow-list. Dispatch through the normal dispatch with a **required audience second argument**: `context.actions.dispatch(action, Audience.Public() | Audience.Private(["vip"]), payload?)` &mdash; `Private` demands a non-empty tuple, there is no public-by-default. The omnicast brand routes the wire leg, the server excludes the sender, receivers validate with the schema before dispatching locally, and validation failures raise `Reason.Rejected` (a `Rejected` error) through `Lifecycle.Error`/`Lifecycle.Fault`. Channeled omnicast (`Distribution.Omnicast<T, C>(schema)`) carries the channel in the envelope; channel values must be JSON-safe primitives. Handlers mutate connection tags via `context.actions.tag.add/remove/clear` (idempotent; no-ops without an `sse` config). Group `Broadcast`/`Omnicast` on a shared `AppActions` class and declare component actions with `export class Actions extends AppActions`. See [recipes/sse.md](./recipes/sse.md).

### Channeled Actions

Target specific handlers using channel objects. The subscriber's channel is the filter: every key the subscriber supplies must be present and equal on the dispatch channel; extra keys on the dispatch channel are ignored. Uncalled actions on either side bypass channel filtering entirely.

```ts
// Second generic defines the channel type
static UserUpdated = Action<User, { UserId: number; Role: string }>("UserUpdated");

// Subscribe to a specific (UserId, Role) pair
actions.useAction(Actions.UserUpdated({ UserId: 5, Role: "admin" }), handler);

// Subscribe to every admin update (partial filter)
actions.useAction(Actions.UserUpdated({ Role: "admin" }), handler);

// Dispatch with a fully-specified channel
actions.dispatch(Actions.UserUpdated({ UserId: 5, Role: "admin" }), user);

// Dispatch uncalled — every handler fires (plain + all channeled)
actions.dispatch(Actions.UserUpdated, user);
```

Channel values must be non-nullable primitives: `string`, `number`, `bigint`, `boolean`, or `symbol`. By convention, use uppercase keys like `{UserId: 4}`.

## Lifecycle Actions

Lifecycle actions are **factory functions** that return unique symbols per call. Assign them as static properties in your Actions class for per-component regulation support:

```ts
import { Lifecycle } from "march-hare";

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Error = Lifecycle.Error();
  static Update = Lifecycle.Update();
  static User = Lifecycle.Reactive<User | undefined>("User");

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
  // fault: { reason, error, action, handled, tasks, retry }
  // fault.retry() re-dispatches the failed action with the same payload
});

actions.useAction(Actions.Update, (context, changes) => {
  // Fires on mount with the initial data ({} when there is no data), then on
  // every context.data change. The mount fire runs while phase is Mounting.
  // changes: Partial<DeepReadonly<D>> — only the data keys whose values
  // changed between renders, typed against the useContext data generic
});

// Reactive: bind an external value at the call site by calling the static.
// Fires once on mount with the current value (defined or undefined, during
// Mounting), then whenever `user` changes by Object.is.
actions.useAction(Actions.User(user), (context, user) => {
  context.actions.produce(({ model }) => void (model.profile = user ?? null));
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
  // context.task.supersede() aborts in-flight siblings of the same action.
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

  context.actions.annotate(value, Op.Update); // Mark async state (Op.Update is the default)

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
import { Op } from "march-hare";

actions.useAction(Actions.Fetch, async (context) => {
  // Mark field as pending
  context.actions.produce(
    ({ model, inspect }) =>
      void (model.user = context.actions.annotate(model.user)),
  );

  const user = await fetchUser();

  // Update with result
  context.actions.produce(({ model }) => void (model.user = user));
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
  context.actions.produce(({ model }) => void (model.selected = mood));
});
```

## Utility Functions

```ts
import { utils } from "march-hare";

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

All three helpers below accept lodash-style dotted paths (`"a.b.c"`) and array indices (`"items.0.name"`). Prefer `context.with.{update,invert,always}` from `app.useContext<Model>()` &mdash; the methods autocomplete keys from the model. The top-level `With.*` form is kept for call sites without a typed context in scope.

### `context.with.update(key)` / `With.Update(key)` &mdash; Bind payload to a model field

```ts
const context = app.useContext<Model, typeof Actions>();
const actions = context.useActions(model);

// Bind action payload directly to model property
actions.useAction(Actions.SetName, context.with.update("name"));

// Nested path:
actions.useAction(Actions.SetCity, context.with.update("address.city"));

// Equivalent hand-written form:
actions.useAction(Actions.SetName, (context, name) => {
  context.actions.produce(({ model }) => void (model.name = name));
});
```

The helper type-checks at the call site: the payload type must match the leaf type at the path, and the path must exist on the model.

### `context.with.invert(key)` / `With.Invert(key)` &mdash; Flip a boolean field

```ts
// Toggle a boolean model property (payload is ignored)
actions.useAction(Actions.ToggleSidebar, context.with.invert("sidebar"));
actions.useAction(Actions.TogglePanel, context.with.invert("panel.open"));
```

Only compiles when the leaf at the path is a boolean. Use it for modals, drawers, panels, and similar binary UI state.

### `context.with.always(key, value)` / `With.Always(key, value)` &mdash; Assign a fixed value

```ts
// Assigns a constant regardless of any dispatched payload
actions.useAction(Actions.Open, context.with.always("panel.open", true));
actions.useAction(Actions.Close, context.with.always("panel.open", false));
actions.useAction(Actions.Ready, context.with.always("phase", "ready"));
```

Useful for pair-of-actions UI patterns (Open/Close, Show/Hide, Start/Stop) where each end of the pair pins the model to a specific value. Type-checks that `value` is assignable to the leaf at `key`.

## Error Handling

### Global Error Handler

```tsx
import { Lifecycle, Reason } from "march-hare";

actions.useAction(
  Lifecycle.Fault,
  (context, { reason, error, action, handled, tasks }) => {
    switch (reason) {
      case Reason.Aborted: // Task aborted (supplanted, unmount, timeout)
      case Reason.Errored: // Uncaught error in handler
    }
  },
);
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

// Debouncing - supersede in-flight siblings, then let the abort cancel the sleep
actions.useAction(Actions.Search, async (context, query) => {
  context.task.supersede();
  await utils.sleep(300, context.task.controller.signal);
  const results = await fetch(`/search?q=${query}`, {
    signal: context.task.controller.signal,
  });
});
```

## Boundary Isolation

Every `<app.Boundary>` (or bare `<Boundary>`) opens a fresh, fully isolated context for its subtree. Two boundaries in the same React tree are **completely separate apps** — they do not share env, broadcast caches, multicast emitters, or stream consumer state. Dispatching a broadcast (including the built-in `Lifecycle.Env` / `Lifecycle.Fault`) inside one boundary never reaches subscribers inside another, even when both boundaries point at the same action symbol.

The same rule applies to `actions.stream(...)`: a stream subscriber attaches to the broadcast emitter of its nearest boundary, and the value cached on that emitter is the only value the subscriber ever sees.

## Env (Per-Boundary Ambient State)

A typed record of cross-cutting, mutable state shared across every component inside a `<Boundary>`. Holds whatever doesn't belong in the model: session tokens, locale, feature flags, current operational mode, etc.

Declare the shape once via module augmentation; supply the initial value via the `<Boundary env={...}>` prop. **Reads** are plain dot notation (`env.session`); **writes** go through `context.actions.produce(({ env }) => { env.x = ... })`, the same Immer-style recipe used for the model. No `.get`/`.set`/`.read` methods on the handle.

- `useEnv()` &mdash; read-only Proxy. Dot reads always reflect the latest value (delegates to the live ref).
- `context.env` &mdash; same Proxy inside `useActions` handlers.
- The `env` field on every `Resource` fetcher's args object &mdash; the same live Proxy as `context.env`. Dot reads inside the fetcher always reflect the latest Env, even across `await` boundaries.

Direct `useEnv()` reads are **not** reactive &mdash; mutating the Env does not re-render components that called `useEnv()`. When the view side needs to react to Env changes, subscribe to the global `Lifecycle.Env` broadcast via `actions.useAction(Lifecycle.Env, ...)` or render against it with `actions.stream(Lifecycle.Env, (env) => ...)`. Use plain dot reads for the _handler_ side; reach for `Lifecycle.Env` for the _view_ side.

```ts
import { useActions, Boundary, Action, Resource } from "march-hare";

// 1. Declare the Env's shape via module augmentation.
declare module "march-hare" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Env {
    session: Session | null;
    operating: "idle" | "signing-out";
  }
}

// 2. Supply the initial Env at the Boundary.
<Boundary env={{ session: null, operating: "idle" }}>
  <App />
</Boundary>;

// 3. Read with dot notation, write with context.actions.produce.
function useSignOutActions() {
  const actions = useActions<void, typeof Actions>();

  actions.useAction(Actions.SignOut, async (context) => {
    context.actions.produce(({ env }) => {
      env.operating = "signing-out";
    });
    await api.signOut();
    context.actions.produce(({ env }) => {
      env.session = null;
      env.operating = "idle";
    });
  });

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.env.operating === "signing-out") return;
    // ...
  });

  return actions;
}

// 4. Resource fetchers read the Env via the context argument.
export const user = Resource((context) =>
  ky.get("/api/user", {
    headers: context.env.session
      ? { Authorization: `Bearer ${context.env.session.accessToken}` }
      : {},
    signal: context.controller.signal,
  }).json<User>(),
);
```

Dot reads stay fresh across `await` boundaries because the handle is a Proxy that delegates to the live ref at every access.

## Context Providers

### `<Boundary>` - All-in-one Provider

```tsx
import { Boundary } from "march-hare";

// Wraps app with Broadcaster, Env, and Tasks providers
<Boundary>
  <App />
</Boundary>;
```

`<Boundary>` also accepts an optional `tap` prop &mdash; a synchronous observer invoked for every action handler dispatch and its terminal (`success` or `error`) inside the boundary. Use it for analytics, audit logging, Sentry breadcrumbs, or replay traces. See [recipes/tap.md](./recipes/tap.md).

```tsx
import { Boundary, type Taps } from "march-hare";

function tap(event: Taps) {
  if (event.stage === "end" && event.result === "error") {
    console.error(event.action.name, event.details.error);
  }
}

<Boundary tap={tap}>
  <App />
</Boundary>;
```

### Multicast scope boundaries

```tsx
import { withScope } from "march-hare";

// Wrap a component with the multicast action that opens its scope.
const ScopedArea = withScope(Scope.Mood, MoodArea);
```

## Reactive Data (Avoiding Stale Closures)

Pass external values via `useActions` data callback for access after `await`:

```ts
function useSearchActions(props: { query: string }) {
  const actions = useActions<Model, typeof Actions, { query: string }>(
    model,
    () => ({
      query: props.query,
    }),
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
import { Handler } from "march-hare";

const handleSetName: Handler<Model, typeof Actions, "SetName"> = (
  context,
  name,
) => {
  context.actions.produce(({ model }) => void (model.name = name));
};
```

### `Handlers<M, A, D>` - HKT for All Handlers

```ts
import { Handlers } from "march-hare";

type H = Handlers<Model, typeof Actions>;

// Index to get specific handler type
const handleSetName: H["SetName"] = (context, name) => { ... };
const handleSetAge: H["SetAge"] = (context, age) => { ... };
```

### `Pk<T>` - Primary Key Type

```ts
import type { Pk } from "march-hare";

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
- Never use `as never` or `as unknown as never` casts. They erase every type guard and hide the fact that the value's real type doesn't fit the slot. If a single-step cast (`value as X`) won't compile, prefer restructuring the function signature, widening the target type, or adding a typed adapter &mdash; reach for `as unknown as X` only when bridging genuinely unrelated branded types, and document the reason inline.
- Don't use single-letter or shorthand variable names &mdash; name the variable for what it is. `for (const cacheKey of cache.keys())` over `for (const k of cache.keys())`; `.map((entry) => ...)` over `.map((e) => ...)`; `(catCall, dogCall)` over `(a, b)`. Loop indices `i`/`j` and generic-parameter letters (`T`, `P`, `E`) are the only acceptable exceptions.

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
- `src/library/actions/index.ts` - useActions hook implementation
- `src/library/actions/utils.ts` - useData, useLifecycles, channel helpers
- `src/library/context/index.ts` - useContext (consumed via `app.useContext`)
- `src/library/with/index.ts` - With.Update / With.Invert helpers
- `src/library/coalesce/index.ts` - withAbort helper for the default-coalesce path
- `src/library/boundary/components/sse/` - per-Boundary SSE connection for omnicast actions (auto connect/disconnect/reconnect, sender exclusion, incoming schema validation)
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
- `src/library/boundary/components/env/` - Per-Boundary Env: typed cross-cutting state primitive

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
  - `env.md` - Per-Boundary Env: typed ambient state (session, locale, feature flags); auto-threaded to Resource fetchers and `context.env`
  - `mount-broadcast-deduplication.md` - Default-coalesce behaviour: mount + broadcast handlers safely share one fetch by `(Resource, params)`
  - `model-annotations.md` - Async state tracking with Immertation
  - `multicast-actions.md` - Scoped component communication
  - `optimistic-updates.md` - End-to-end optimistic create/update/delete with `utils.pk()`, annotations, and rollback via `Lifecycle.Error`
  - `react-context-in-handlers.md` - Using context.data
  - `reactive-values.md` - `Lifecycle.Reactive`: bind an external value (React Query result, prop, store selector) at the `useAction` site via `Actions.X(value)`; the handler fires through the full dispatch pipeline whenever the value changes by `Object.is`, and once on mount if already defined
  - `real-time-applications.md` - SSE/WebSocket patterns
  - `referential-equality.md` - Avoiding stale closures
  - `session-tokens.md` - Session tokens in the Env; HttpOnly cookies vs. Bearer in Env; refresh-on-401 via ky `afterResponse` hook
  - `sse.md` - Omnicast actions over SSE: `Distribution.Omnicast(schema?)` + `App({ sse })`; the Boundary auto-manages the connection, one `dispatch` does local + wire legs with sender exclusion, Zod-style schemas validate incoming envelopes and reject invalid payloads, `{ tags }` dispatch option for ALL-tags targeting, `AppActions` base-class pattern
  - `stateful-props.md` - Box<T> type for stateful props
  - `storage.md` - Cache class for cross-reload persistence; adapters for localStorage / MMKV / chrome.storage
  - `tap.md` - `<Boundary tap={...}>` observer fired on every handler dispatch and its terminal (`success` / `error`); analytics, audit log, Sentry breadcrumbs
  - `use-resource.md` - Resource: declare at module scope, sync read via `.get(params)`, fetch via `context.actions.resource(...).exceeds(...)`, auto-broadcast via `resource.x.action(partial?)` after every successful fetch **and every eviction** (payload `T | null` &mdash; null on evict/nuke, T on success). Fetcherless form `app.Resource<T, P>()` / `shared.Resource<E, T, P>()` declares a **local resource** written via `context.actions.resource(...).set(value)` &mdash; one write path per variant: fetched resources have no `.set()`, local invocations are not awaitable and have no `.exceeds()`/`.isolated()`
  - `utility-functions.md` - sleep, pk utilities
  - `utility-types.md` - Handler, Handlers types
  - `void-model.md` - Actions without local state
