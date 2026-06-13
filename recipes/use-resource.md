# Resource

`Resource(fetcher)` declares a remote interaction at module scope. There's no `useResource` hook &mdash; consume Resources directly:

- **`resource.user(params?)`** &mdash; synchronous read of the cached payload for those params. Returns `T | null`. Safe to call at module scope, in the model literal, anywhere. As a side effect, the call primes the slot that the next `context.actions.resource(...)` consumes &mdash; whether for a fetch (`.then`/`await`), an eviction (`.evict()`), or a freshness gate (`.exceeds()`).
- **`context.actions.resource(resource.user(params?))`** &mdash; fires the fetch from an action handler. Auto-threads the `AbortController` from `context.task.controller` and a live handle to the per-`<Boundary>` Env. Returns a thenable that's also chainable with `.exceeds({ minutes: 5 })` for cache-aware refresh.

The fetcher itself receives a single `context` argument carrying `env`, `controller`, `params`, and a broadcast/multicast-only `dispatch`. Access fields directly via `context.controller.signal`, `context.params.id`, etc. &mdash; do not destructure. Pass `context.controller.signal` to `fetch`/`ky`/`EventSource` for cancellation.

```ts
// resources.ts
import { app } from "./app";

export const user = app.Resource<User, { id: number }>((context) =>
  ky
    .get(`users/${context.params.id}`, {
      signal: context.controller.signal,
    })
    .json<User>(),
);

export const pay = app.Resource<Receipt, Body>((context) =>
  ky
    .post("pay", {
      json: context.params,
      signal: context.controller.signal,
    })
    .json<Receipt>(),
);

// Simple no-env, no-params:
export const ping = app.Resource((context) =>
  ky.get("ping", { signal: context.controller.signal }).text(),
);
```

```tsx
// actions.ts
import { app } from "./app";
import * as resource from "./resources";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({
    // Sync cache read at the model literal — returns null when nothing is cached.
    user: resource.user({ id: 5 }),
  });

  actions.useAction(Actions.Mount, async (context) => {
    // Fires immediately (no freshness window).
    const user = await context.actions.resource(resource.user({ id: 5 }));
    context.actions.produce(({ model }) => void (model.user = user));
  });

  actions.useAction(Actions.Refresh, async (context) => {
    // Reuses cache when < 5 minutes old; otherwise fetches.
    const user = await context.actions
      .resource(resource.user({ id: 5 }))
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.user = user));
  });

  actions.useAction(Actions.Submit, async (context, body) => {
    const pay = await context.actions.resource(resource.pay(body));
    context.actions.produce(({ model }) => void (model.receipt = pay));
  });

  return actions;
}
```

Every successful fetch writes through to a per-resource in-memory cache. Configure `App({ cache })` to persist payloads across reloads (covered below), or chain `.coalesce(token)` on the call site to share an in-flight fetch with other callers.

> **Convention:** keep resources in `resources.ts` and pull them in as a namespace (`import * as resource from "./resources"`). Awaited results are named after the resource function they invoke &mdash; `const user = await context.actions.resource(resource.user())` &mdash; so call sites read uniformly and a single grep (`resource.user(`) finds every consumer.

> **Temporal runtime requirement.** `.exceeds({...})` reads a `Temporal.Instant` internally. March Hare reads `Temporal` from the host global, so consumers targeting runtimes that do not yet expose it natively must install a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) once at app entry.

## How the call form works

`resource.user(params)` does two things in one expression:

1. Returns the per-params cache value synchronously (`T | null`).
2. Primes a single module-scope slot with the fetcher and params. The next `context.actions.resource(...)` or `.resource(...).evict(...)` call consumes that slot.

The slot is consumed the moment `.resource(...)` runs, so the natural inline pattern (`context.actions.resource(resource.user({id:5}))`) always pairs correctly. If a `resource.user(...)` call is not followed by a `.resource(...)` consumption, the slot self-clears on the next microtask &mdash; so stray calls (e.g. in the model literal) don't leak into later handler runs.

Keep `resource.user(...)` and `.resource(...)` in the same expression. Splitting them across an `await` lets unrelated `resource.cat(...)` calls overwrite the slot in between.

## The fetcher's `context` argument

```ts
type Context<P> = {
  env: Env; // live read-only handle to the per-<Boundary> Env
  controller: AbortController;
  params: P;
  dispatch: Dispatch; // broadcast / multicast only — unicast is rejected at compile time
};
```

- **`env`** &mdash; a live read-only handle to the per-`<Boundary>` [Env](./env.md). Read session tokens, locale, feature flags, anything cross-cutting. The handle is the same `Proxy` exposed to handlers via `context.env`, so dot reads inside the fetcher always reflect the latest value &mdash; even across `await` boundaries when another handler mutates the Env mid-flight. Copy into a local at the top of the fetcher if you need a stable snapshot.
- **`controller`** &mdash; the `AbortController` auto-threaded from `context.task.controller`. Pass `context.controller.signal` to `ky`/`fetch`/`EventSource` to thread cancellation; when the action's task is aborted (component unmount, supersede, manual abort), the in-flight request is cancelled. Call `context.controller.abort()` if the fetcher needs to fail fast.
- **`params`** &mdash; the call-site params object, typed by the Resource's second generic.
- **`dispatch`** &mdash; fire a [broadcast](./broadcast-actions.md) or [multicast](./multicast-actions.md) action from inside the fetcher. Unicast actions target the calling component &mdash; a Resource fetcher has no component, so unicast is rejected at compile time. Use for cross-component side-effects that should fire as soon as the fetch enters a particular state, regardless of which component awaited it.

Always access fields via `context.x` rather than destructuring &mdash; the signature stays stable as the fetcher grows.

## Per-params caching

Each unique params object gets its own cache slot, keyed internally by `JSON.stringify(params)`. `user({ id: 5 })` and `user({ id: 6 })` therefore have independent caches:

```ts
// First fetch populates the {"id":5} slot.
await context.actions.resource(resource.user({ id: 5 }));

// Different params — independent slot, independent freshness window.
await context.actions.resource(resource.user({ id: 6 }));

// Reuse cache for {"id":5} when < 5 min old.
await context.actions
  .resource(resource.user({ id: 5 }))
  .exceeds({ minutes: 5 });

// Sync read of whichever slot you want.
const fiveCached: User | null = resource.user({ id: 5 });
```

Two callers producing structurally equal params (same key order, same primitive values) hit the same slot.

## Sync cache read

Calling `resource.user(params)` directly reads the most recent successful payload synchronously. Returns `null` when nothing has resolved yet (whether through "never fetched" or "fetch is still pending").

Use it in the model literal to seed initial state from the cache:

```ts
const context = useContext<Model, typeof Actions>();
const actions = context.useActions({
  user: resource.user({ id }), // User | null
});
```

Or in a handler to recover from a failed refresh:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  try {
    const user = await context.actions.resource(resource.user({ id }));
    context.actions.produce(({ model }) => void (model.user = user));
  } catch {
    context.actions.produce(
      ({ model }) => void (model.user = resource.user({ id })),
    );
  }
});
```

The cache is module-scope, so every caller of `resource.user({ id: 5 })` &mdash; from a model literal, a handler, even a non-React utility &mdash; sees the same payload.

## `.exceeds({...})` &mdash; conditional refresh

For "refresh, but don't bother if we just ran" semantics:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  const user = await context.actions
    .resource(resource.user({ id }))
    .exceeds({ minutes: 5 });
  context.actions.produce(({ model }) => void (model.user = user));
});
```

`.exceeds(duration)` accepts a `Temporal.Duration`, a `DurationLike` object (`{ minutes: 5 }`, `{ seconds: 30 }`), or an ISO 8601 duration string (`"PT5M"`).

If the most recent successful fetch for those params resolved longer ago than the window (i.e. the cache age _exceeds_ the duration), the fetcher fires. Otherwise the cached value resolves immediately.

`.exceeds` is also a duplicate-submit guard for writes &mdash; `await context.actions.resource(resource.pay(body)).exceeds({ seconds: 5 })` only fires if no `resource.pay(body)` has succeeded in the last five seconds.

## Reading the Env inside fetchers

Every fetcher receives the per-`<Boundary>` Env on its context. Use it for ambient values like the session token:

```ts
export const user = app.Resource<User, { id: number }>((context) =>
  ky
    .get(`users/${context.params.id}`, {
      headers: context.env.session
        ? { Authorization: `Bearer ${context.env.session.accessToken}` }
        : {},
      signal: context.controller.signal,
    })
    .json<User>(),
);
```

See [session-tokens](./session-tokens.md) for the full auth pattern and [env](./env.md) for the underlying primitive.

## Fanning out on success or failure

There are two places to fire a broadcast or multicast for a resource:

- **From the fetcher**, via `context.dispatch`. Best for things every interested component should learn as soon as the data arrives, independent of who awaited the run &mdash; freshness pings, analytics, cache invalidation. Unicast is rejected at compile time because a fetcher has no component to deliver to.
- **From the handler**, via `context.actions.dispatch` after the `await`. Best for events that depend on the awaiter's local state &mdash; "this specific component just finished loading", model-write follow-ups, error narrowing.

```ts
// resources.ts — fan-out happens inside the fetcher.
export const user = app.Resource<User, { id: number }>(async (context) => {
  const data = await ky
    .get(`users/${context.params.id}`, {
      signal: context.controller.signal,
    })
    .json<User>();
  await context.dispatch(Actions.Broadcast.UserUpdated, data);
  return data;
});
```

```ts
// actions.ts — handler-side dispatch for awaiter-local concerns.
actions.useAction(Actions.Mount, async (context) => {
  try {
    const user = await context.actions.resource(resource.user({ id: 5 }));
    context.actions.produce(({ model }) => void (model.user = user));
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

When several components need to react to a resource update, the pattern is: the fetcher (or a single awaiting handler) dispatches a broadcast; every other component subscribes to that broadcast via `useAction`. See [broadcast-actions](./broadcast-actions.md) for the receiving side.

> **Note:** TypeScript cannot type promise rejections, so `await context.actions.resource(...)` rejects with `unknown`. To narrow inline, use `error instanceof YourErrorClass` checks within a `try/catch`.

## Persistent cache &mdash; `App({ cache })`

`app.Resource(fetcher)` keeps successful payloads in an in-memory slot only &ndash; the cache resets on every page load. To keep the most recent successful payload across reloads, attach a `Cache` to the App and every `app.Resource` declaration shares it:

```ts
// app.ts
import { App, Cache } from "march-hare";

export const app = App({
  env: { session: null as Session | null },
  cache: Cache({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    clear: () => localStorage.clear(),
  }),
});
```

```ts
// resources.ts &mdash; persisted via the App's cache.
import { app } from "./app";

export const user = app.Resource<User, { id: number }>((context) =>
  ky
    .get(`users/${context.params.id}`, {
      signal: context.controller.signal,
    })
    .json<User>(),
);
```

Resources declared on the same App are namespaced internally by their module-evaluation order, so two resources called with the same params don't collide on the shared adapter. Because module load order is deterministic, every reload reuses the same namespace key per resource and seeds back from storage on the next sync read.

See the [storage recipe](./storage.md) for adapter examples (`localStorage`, MMKV, `chrome.storage`) and sign-out cache purging.

## Invalidation &mdash; `.evict()` and `.nuke()`

Cache writes happen automatically on every successful fetch; eviction is the inverse and stays explicit. Both forms use **partial-match** semantics &mdash; the supplied pattern's keys must equal the stored params' values; extra keys in the stored params are ignored. Both work against the in-memory slot **and** the persisted entries from `App({ cache })`.

### `context.actions.resource(...).evict(where?)` &mdash; per-resource

Chains off `context.actions.resource(...)` so it shares the same primed-slot mechanism as `.exceeds(...)` and `.coalesce(...)`. With no argument, the originating call's params become the pattern; pass `(where)` to override.

```ts
// Drop the {id: 5} slot for the user resource only.
actions.useAction(Actions.UserDeleted, (context, { id }) => {
  context.actions.resource(resource.user({ id })).evict();
});
```

```ts
// Override the pattern: drop every user slot whose stored params include
// `teamId: 4`, regardless of other keys (`id`, `since`, etc).
actions.useAction(Actions.Broadcast.TeamDisbanded, (context, { teamId }) => {
  context.actions.resource(resource.user()).evict({ teamId });
});
```

```ts
// No-params resource: evict drops the single {} slot.
actions.useAction(Actions.Logout, (context) => {
  context.actions.resource(resource.banner()).evict();
});
```

```ts
// Invalidate so the next `.exceeds()` reader skips the freshness window.
// Without the evict, a refresh handler running ~1 minute after the mutation
// would short-circuit on the stale cached payload.
actions.useAction(Actions.Rename, async (context, { id, name }) => {
  await context.actions.resource(resource.updateUser({ id, name }));
  context.actions.resource(resource.user({ id })).evict();
});

actions.useAction(Actions.Refresh, async (context, { id }) => {
  const user = await context.actions
    .resource(resource.user({ id }))
    .exceeds({ minutes: 5 });
  context.actions.produce(({ model }) => void (model.user = user));
});
```

```ts
// Sync readers also see fresh state. The model literal pulls from the cache
// at construction, so a stale entry would seed the next render with the
// pre-mutation payload until something refetches.
actions.useAction(Actions.Logout, (context) => {
  context.actions.resource(resource.user({ id: context.env.userId })).evict();
});

function useProfileActions() {
  const context = app.useContext<Model, typeof Actions>();
  // After the Logout handler runs, this reads null instead of the stale user.
  return context.useActions({
    user: resource.user({ id: context.env.userId }),
  });
}
```

```ts
// Evict by a subset of the original params: a write that returns the
// affected user IDs invalidates exactly those slots.
actions.useAction(Actions.BulkUpdate, async (context, payload) => {
  const { affectedIds } = await context.actions.resource(
    resource.bulk(payload),
  );
  for (const id of affectedIds) {
    context.actions.resource(resource.user({ id })).evict();
  }
});
```

### `context.actions.resource.nuke(where?)` &mdash; across every resource

Spans every `app.Resource` and `shared.Resource` declared in the process. Pattern matching is the same partial-match logic, but applied resource-by-resource &mdash; only slots whose stored params satisfy the pattern get dropped.

```ts
// Wipe everything on sign-out — the next mount starts from a clean cache.
actions.useAction(Actions.SignOut, async (context) => {
  await context.actions.resource(resource.signOut());
  context.actions.produce(({ env }) => void (env.session = null));
  context.actions.resource.nuke();
});
```

```ts
// Surgical: every cache entry — across user, post, comment, etc. —
// whose stored params include `id: 5` gets evicted. Resources that
// don't include `id` in their params are untouched.
actions.useAction(Actions.PurgeUserData, (context, { id }) => {
  context.actions.resource.nuke({ id });
});
```

```ts
// Tenancy switch: drop every cached entry tied to the previous tenant
// regardless of which resource owns it.
actions.useAction(Actions.SwitchTenant, async (context, { tenantId }) => {
  context.actions.resource.nuke({ tenantId: context.env.tenantId });
  context.actions.produce(({ env }) => void (env.tenantId = tenantId));
});
```

### What `.evict()` and `.nuke()` do **not** do

- **They don't fire any action.** Evicting a slot drops the cached payload but doesn't notify subscribers. If a render needs to react, dispatch a broadcast alongside the eviction &mdash; see [real-time-applications](./real-time-applications.md).
- **They don't refetch.** Evict + refetch is a two-step pattern; chain the next `context.actions.resource(...)` explicitly when you want a fresh load.
- **They don't cancel in-flight fetches.** A pending `await context.actions.resource(...)` finishes naturally and writes its result. Combine with `context.task.controller.abort()` if you need to discard a racing request.

## In-flight coalescing &mdash; `.coalesce(token)`

By default every `await context.actions.resource(...)` fires a fresh network request. Opt in to in-flight sharing per call by chaining `.coalesce(token)` &mdash; while one fetch is in-flight for the same `(Resource, params, token)` triple, every other caller receives the same promise. One network request, multiple awaits, all resolutions with the same payload.

Use an enum for the token so call sites stay typed and greppable:

```ts
enum Coalesce {
  Dashboard,
}

actions.useAction(Actions.Mount, async (context) => {
  const dashboard = await context.actions
    .resource(resource.dashboard())
    .coalesce(Coalesce.Dashboard);
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});

actions.useAction(Actions.Broadcast.User, async (context, payload) => {
  const dashboard = await context.actions
    .resource(resource.dashboard({ userId: payload.id }))
    .coalesce(Coalesce.Dashboard);
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});
```

See the [mount deduplication recipe](./mount-broadcast-deduplication.md) for the full pattern, including how the `(Resource, params, token)` triple keys the dedupe map.

## Optimistic updates

The canonical pattern for a write that updates the model: annotate the field as pending, fire the call, swap in the server response (or roll back on failure):

```ts
import { Op } from "march-hare";

actions.useAction(Actions.Rename, async (context, name) => {
  const user = context.model.user;
  if (!user) return;
  context.actions.produce(({ model }) => {
    model.user = context.actions.annotate({ ...user, name }, Op.Update);
  });

  try {
    const updateUser = await context.actions.resource(
      resource.updateUser({ id: user.id, name }),
    );
    context.actions.produce(({ model }) => void (model.user = updateUser));
  } catch (error) {
    context.actions.produce(({ model }) => void (model.user = user));
    throw error;
  }
});
```

Pending state drives the UI via `actions.inspect.user.pending()` &mdash; see [model-annotations](./model-annotations.md).

## Run semantics

By default every `await context.actions.resource(...)` fires a fresh network request &mdash; coordination across components happens at the broadcast layer, not at a hidden cache:

```ts
const a = context.actions.resource(resource.user({ id: 5 }));
const b = context.actions.resource(resource.user({ id: 5 }));
const c = context.actions.resource(resource.user({ id: 5 }));
await Promise.all([a, b, c]); // three network requests
```

Each successful response writes through to the per-params cache slot; whichever resolves last for a given params hash wins.

Opt in to in-flight sharing per call by chaining `.coalesce(token)`. While one fetch is in-flight for the same `(Resource, params, token)` triple, every other caller receives the same promise &mdash; one network request, multiple awaits, all resolutions with the same payload. See [`.coalesce(token)`](#in-flight-coalescing--coalescetoken) below.

## Mount-time pattern

```ts
actions.useAction(Actions.Mount, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.user = context.actions.annotate(model.user, Op.Update)),
  );

  const user = await context.actions.resource(resource.user({ id }));

  context.actions.produce(({ model }) => void (model.user = user));
});
```

The `annotate` call drives the loading UI via `actions.inspect.user.pending()` &mdash; see [model-annotations](./model-annotations.md). Refresh has the same body, just call `context.actions.resource(resource.user(...))` again.

## Infinite scroll

```ts
// resources.ts
export const feed = app.Resource<Page<Item>, { cursor: string | null }>(
  (context) =>
    http
      .get("feed", {
        searchParams: { cursor: context.params.cursor ?? "" },
        signal: context.controller.signal,
      })
      .json<Page<Item>>(),
);
```

```ts
// actions.ts
actions.useAction(Actions.LoadMore, async (context) => {
  if (!context.model.hasMore) return;
  const feed = await context.actions.resource(
    resource.feed({ cursor: context.model.cursor }),
  );
  context.actions.produce(({ model }) => {
    model.items.push(...feed.items);
    model.cursor = feed.nextCursor;
    model.hasMore = feed.nextCursor !== null;
  });
});
```

Each cursor gets its own cache slot &mdash; `.exceeds({...})` is per-cursor, so a fresh page-1 fetch doesn't short-circuit a page-2 refresh. See `src/example/transactions/` for the live IntersectionObserver pattern.

## Limitations

- **No persistence across reloads by default.** Opt in via `App({ cache })`. The Cache writes through on every successful fetch and auto-seeds from storage on first read. See [storage](./storage.md).
- **No focus or reconnect revalidation.** Wire a `window` listener and call `context.actions.resource(...)` again if you need this.
- **No SSR isolation.** The cache is module-global, so server-side rendering would leak across requests. `Resource` is client-only.
- **No subscription on the awaiter.** `await context.actions.resource(...)` resolves once and does not re-fire when a broadcast goes out. Use `useAction(broadcastAction)` for change notifications.
- **`resource.user(params)` is not reactive.** Reading it inside render does not subscribe the component to updates &mdash; it is a snapshot, not a signal. Drive UI from the model.
- **Pair `resource.user(...)` with `.resource(...)` in the same expression.** The call-form primes a module-scope slot; an unrelated `resource.cat(...)` call before `.resource(...)` consumes will overwrite it. Inline usage (`.resource(resource.user({id:5}))`) is always safe; the slot self-clears on the next microtask.
- **Params keying is structural via `JSON.stringify`.** Two callers must produce structurally equal params (same key order, same primitive values) to share a cache slot. Avoid `Date`, `BigInt`, `Symbol`, or non-stable object identities in params.
