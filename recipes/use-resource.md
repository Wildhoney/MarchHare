# Resource

`Resource(fetcher)` declares a remote interaction at module scope. There's no `useResource` hook &mdash; consume Resources directly:

- **`user(params?)`** &mdash; synchronous read of the cached payload for those params. Returns `T | null`. Safe to call at module scope, in the model literal, anywhere. As a side effect, the call primes the slot that `context.actions.resource(...)` / `.set(...)` consume next.
- **`context.actions.resource(user(params?))`** &mdash; fires the fetch from an action handler. Auto-threads the `AbortController` from `context.task.controller` and the per-`<Boundary>` Store snapshot. Returns a thenable that's also chainable with `.exceeds({ minutes: 5 })` for cache-aware refresh.

The fetcher itself receives `{ store, controller, params }` &mdash; destructure whichever you need. Pass `controller.signal` to `fetch`/`ky`/`EventSource` for cancellation.

```ts
// resources.ts
import { Resource } from "march-hare";

export const user = Resource<User, { id: number }>(({ controller, params }) =>
  ky.get(`users/${params.id}`, { signal: controller.signal }).json<User>(),
);

export const pay = Resource<Receipt, Body>(({ controller, params }) =>
  ky.post("pay", { json: params, signal: controller.signal }).json<Receipt>(),
);

// Simple no-store, no-params:
export const ping = Resource(({ controller }) =>
  ky.get("ping", { signal: controller.signal }).text(),
);
```

```tsx
// actions.ts
import { useActions } from "march-hare";
import { user, pay } from "./resources";

export function useActions() {
  const actions = useActions<Model, Actions>({
    // Sync cache read at the model literal — returns null when nothing is cached.
    user: user({ id: 5 }),
  });

  actions.useAction(Actions.Mount, async (context) => {
    // Fires immediately (no freshness window).
    const data = await context.actions.resource(user({ id: 5 }));
    context.actions.produce(({ model }) => void (model.user = data));
  });

  actions.useAction(Actions.Refresh, async (context) => {
    // Reuses cache when < 5 minutes old; otherwise fetches.
    const data = await context.actions
      .resource(user({ id: 5 }))
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.user = data));
  });

  actions.useAction(Actions.Submit, async (context, body) => {
    const receipt = await context.actions.resource(pay(body));
    context.actions.produce(({ model }) => void (model.receipt = receipt));
  });

  return actions;
}
```

Every successful fetch writes through to the per-fetcher {@link Cache} (in-memory by default, persistent when an adapter is supplied via the second arg to `Resource`).

> **Convention:** keep resources in `resources.ts` and pull them in with named imports (`import { user, pay } from "./resources"`). The grouping signals "remote interactions, declared at module scope" at a glance.

> **Temporal runtime requirement.** `.exceeds({...})` reads a `Temporal.Instant` internally. March Hare reads `Temporal` from the host global, so consumers targeting runtimes that do not yet expose it natively must install a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) once at app entry.

## How the call form works

`user(params)` does two things in one expression:

1. Returns the per-params cache value synchronously (`T | null`).
2. Primes a single module-scope slot with the fetcher and params. The next `context.actions.resource(...)` or `.resource.set(...)` call consumes that slot.

The slot is consumed the moment `.resource(...)` runs, so the natural inline pattern (`context.actions.resource(user({id:5}))`) always pairs correctly. If a `user(...)` call is not followed by a `.resource(...)` consumption, the slot self-clears on the next microtask &mdash; so stray calls (e.g. in the model literal) don't leak into later handler runs.

Keep `user(...)` and `.resource(...)` in the same expression. Splitting them across an `await` lets unrelated `cat(...)` calls overwrite the slot in between.

## The fetcher's args object

```ts
type Args<P> = {
  store: Store; // per-<Boundary> ambient state snapshot (read-only)
  controller: AbortController;
  params: P;
};
```

- **`store`** &mdash; a snapshot of the per-`<Boundary>` [Store](./store.md) at the moment of fetch. Read session tokens, locale, feature flags, anything cross-cutting. The snapshot is captured at fetcher-start; mid-flight Store changes don't affect this fetch but the next one picks them up.
- **`controller`** &mdash; the `AbortController` auto-threaded from `context.task.controller`. Pass `controller.signal` to `ky`/`fetch`/`EventSource` to thread cancellation; when the action's task is aborted (component unmount, supersede, manual abort), the in-flight request is cancelled. Call `controller.abort()` if the fetcher needs to fail fast.
- **`params`** &mdash; the call-site params object, typed by the Resource's second generic.

Destructure only what you need. No-store, no-params resources collapse to `({ controller })`.

## Per-params caching

Each unique params object gets its own cache slot, keyed internally by `JSON.stringify(params)`. `user({ id: 5 })` and `user({ id: 6 })` therefore have independent caches:

```ts
// First fetch populates the {"id":5} slot.
await context.actions.resource(user({ id: 5 }));

// Different params — independent slot, independent freshness window.
await context.actions.resource(user({ id: 6 }));

// Reuse cache for {"id":5} when < 5 min old.
await context.actions.resource(user({ id: 5 })).exceeds({ minutes: 5 });

// Sync read of whichever slot you want.
const fiveCached: User | null = user({ id: 5 });
```

Two callers producing structurally equal params (same key order, same primitive values) hit the same slot.

## Sync cache read

Calling `user(params)` directly reads the most recent successful payload synchronously. Returns `null` when nothing has resolved yet (whether through "never fetched" or "fetch is still pending").

Use it in the model literal to seed initial state from the cache:

```ts
const actions = useActions<Model, Actions>({
  user: user({ id }), // User | null
});
```

Or in a handler to recover from a failed refresh:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  try {
    const data = await context.actions.resource(user({ id }));
    context.actions.produce(({ model }) => void (model.user = data));
  } catch {
    context.actions.produce(({ model }) => void (model.user = user({ id })));
  }
});
```

The cache is module-scope, so every caller of `user({ id: 5 })` &mdash; from a model literal, a handler, even a non-React utility &mdash; sees the same payload.

## `.exceeds({...})` &mdash; conditional refresh

For "refresh, but don't bother if we just ran" semantics:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  const data = await context.actions
    .resource(user({ id }))
    .exceeds({ minutes: 5 });
  context.actions.produce(({ model }) => void (model.user = data));
});
```

`.exceeds(duration)` accepts a `Temporal.Duration`, a `DurationLike` object (`{ minutes: 5 }`, `{ seconds: 30 }`), or an ISO 8601 duration string (`"PT5M"`).

If the most recent successful fetch for those params resolved longer ago than the window (i.e. the cache age _exceeds_ the duration), the fetcher fires. Otherwise the cached value resolves immediately.

`.exceeds` is also a duplicate-submit guard for writes &mdash; `await context.actions.resource(pay(body)).exceeds({ seconds: 5 })` only fires if no `pay(body)` has succeeded in the last five seconds.

## Reading the Store inside fetchers

Every fetcher receives the per-`<Boundary>` Store on its args object. Use it for ambient values like the session token:

```ts
export const user = Resource<User, { id: number }>(
  ({ store, controller, params }) =>
    ky
      .get(`users/${params.id}`, {
        headers: store.session
          ? { Authorization: `Bearer ${store.session.accessToken}` }
          : {},
        signal: controller.signal,
      })
      .json<User>(),
);
```

See [session-tokens](./session-tokens.md) for the full auth pattern and [store](./store.md) for the underlying primitive.

## Fanning out on success or failure

Resources don't dispatch anything themselves. Compose dispatch and other side-effects in the calling handler &mdash; the same place the `await` lives:

```ts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await context.actions.resource(user({ id: 5 }));
    await context.actions.dispatch(Actions.Broadcast.UserUpdated, data);
    context.actions.produce(({ model }) => void (model.user = data));
  } catch (error) {
    if (error instanceof RateLimitedError) {
      await context.actions.dispatch(
        Actions.Broadcast.RateLimited,
        error.retryAfter,
      );
    }
    throw error;
  }
});
```

When several components need to react to a resource update, the pattern is: one component awaits the run and dispatches a broadcast; every other component subscribes to that broadcast via `useAction`. See [broadcast-actions](./broadcast-actions.md) for the receiving side.

> **Note:** TypeScript cannot type promise rejections, so `await context.actions.resource(...)` rejects with `unknown`. To narrow inline, use `error instanceof YourErrorClass` checks within a `try/catch`.

## Optimistic updates

The canonical pattern for a write that updates the model: annotate the field as pending, fire the call, swap in the server response (or roll back on failure):

```ts
import { Op } from "march-hare";

actions.useAction(Actions.Rename, async (context, name) => {
  const previous = context.model.user;
  context.actions.produce(({ model }) => {
    model.user = context.actions.annotate({ ...model.user!, name }, Op.Update);
  });

  try {
    const updated = await context.actions.resource(
      updateUser({ id: previous!.id, name }),
    );
    context.actions.produce(({ model }) => void (model.user = updated));
  } catch (error) {
    context.actions.produce(({ model }) => void (model.user = previous));
    throw error;
  }
});
```

Pending state drives the UI via `actions.inspect.user.pending()` &mdash; see [model-annotations](./model-annotations.md).

## Run semantics

Every `await context.actions.resource(...)` fires a fresh network request. There is **no in-flight coalescing** &mdash; calling it three times concurrently produces three requests. Coordination across components happens at the broadcast layer, not at a hidden cache.

```ts
const a = context.actions.resource(user({ id: 5 }));
const b = context.actions.resource(user({ id: 5 }));
const c = context.actions.resource(user({ id: 5 }));
await Promise.all([a, b, c]); // three network requests
```

Each successful response writes through to the per-params cache slot; whichever resolves last for a given params hash wins.

## Mount-time pattern

```ts
actions.useAction(Actions.Mount, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.user = context.actions.annotate(model.user, Op.Update)),
  );

  const data = await context.actions.resource(user({ id }));

  context.actions.produce(({ model }) => void (model.user = data));
});
```

The `annotate` call drives the loading UI via `actions.inspect.user.pending()` &mdash; see [model-annotations](./model-annotations.md). Refresh has the same body, just call `context.actions.resource(...)` again.

## Infinite scroll

```ts
// resources.ts
export const feed = Resource<Page<Item>, { cursor: string | null }>(
  ({ controller, params }) =>
    http
      .get("feed", {
        searchParams: { cursor: params.cursor ?? "" },
        signal: controller.signal,
      })
      .json<Page<Item>>(),
);
```

```ts
// actions.ts
actions.useAction(Actions.LoadMore, async (context) => {
  if (!context.model.hasMore) return;
  const page = await context.actions.resource(
    feed({ cursor: context.model.cursor }),
  );
  context.actions.produce(({ model }) => {
    model.items.push(...page.items);
    model.cursor = page.nextCursor;
    model.hasMore = page.nextCursor !== null;
  });
});
```

Each cursor gets its own cache slot &mdash; `.exceeds({...})` is per-cursor, so a fresh page-1 fetch doesn't short-circuit a page-2 refresh. See `src/example/transactions/` for the live IntersectionObserver pattern.

## Limitations

- **No persistence across reloads by default.** Opt in by wiring a `Cache` instance into the Resource: `Resource(fetcher, Cache(adapter))`. The Cache writes through on every successful fetch and auto-seeds from storage on first read. See [storage](./storage.md).
- **No focus or reconnect revalidation.** Wire a `window` listener and call `context.actions.resource(...)` again if you need this.
- **No SSR isolation.** The cache is module-global, so server-side rendering would leak across requests. `Resource` is client-only.
- **No subscription on the awaiter.** `await context.actions.resource(...)` resolves once and does not re-fire when a broadcast goes out. Use `useAction(broadcastAction)` for change notifications.
- **`user(params)` is not reactive.** Reading it inside render does not subscribe the component to updates &mdash; it is a snapshot, not a signal. Drive UI from the model.
- **Pair `user(...)` with `.resource(...)` in the same expression.** The call-form primes a module-scope slot; an unrelated `cat(...)` call before `.resource(...)` consumes will overwrite it. Inline usage (`.resource(user({id:5}))`) is always safe; the slot self-clears on the next microtask.
- **Params keying is structural via `JSON.stringify`.** Two callers must produce structurally equal params (same key order, same primitive values) to share a cache slot. Avoid `Date`, `BigInt`, `Symbol`, or non-stable object identities in params.
