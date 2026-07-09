# Resource

`Resource(fetcher)` declares a remote interaction at module scope. There's no `useResource` hook &mdash; consume Resources directly:

- **`resource.user.get(params?)`** &mdash; synchronous read of the cached payload for those params. Returns `T | null`. Safe to call at module scope, in the model literal, anywhere. Has no side effects: it only reads the per-params cache slot.
- **`resource.user(params?)`** &mdash; produces an `Invocation` describing the call. Pass it to `context.actions.resource(...)` for the fetch path or to `.evict(...)` for eviction; outside that, the value is inert.
- **`context.actions.resource(resource.user(params?))`** &mdash; fires the fetch from an action handler. Auto-threads the `AbortController` from `context.task.controller` and a live handle to the per-`<Boundary>` Env. Returns a thenable that's also chainable with `.exceeds({ minutes: 5 })` for cache-aware refresh.

The fetcher receives a single `context` argument carrying `env`, `controller`, `params`, and a broadcast/multicast-only `dispatch`. Access fields directly via `context.controller.signal`, `context.params.id`, etc. &mdash; do not destructure. Pass `context.controller.signal` to `fetch`/`ky`/`EventSource` for cancellation.

Declaring a Resource **without a fetcher** (`app.Resource<T, P>()`) yields a [local resource](#local-resources--no-fetcher) &mdash; same cache, broadcast, and eviction machinery, written through `.set(value)` instead of a fetch.

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

// No-env, no-params:
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
    user: resource.user.get({ id: 5 }),
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

Every successful fetch writes through to a per-resource in-memory cache. Configure `App({ cache })` to persist payloads across reloads (covered below). Concurrent callers with the same `(Resource, params)` automatically share a single in-flight fetch &mdash; no `.coalesce()` chain to remember.

> **Convention:** keep resources in `resources.ts` and pull them in as a namespace (`import * as resource from "./resources"`). Awaited results are named after the resource function they invoke &mdash; `const user = await context.actions.resource(resource.user())` &mdash; so call sites read uniformly and a single grep (`resource.user(`) finds every consumer.

> **Temporal runtime requirement.** `.exceeds({...})` reads a `Temporal.Instant` internally. March Hare reads `Temporal` from the host global, so consumers targeting runtimes that do not yet expose it natively must install a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) once at app entry.

## How the call forms work

Each Resource handle has two callable forms with different return shapes:

- `resource.user.get(params)` &mdash; returns the per-params cache value synchronously (`T | null`). Pure read; no side effects on the registry, no module-level state to corrupt.
- `resource.user(params)` &mdash; returns an `Invocation` &mdash; a plain object carrying the fetcher, params, and eviction closure. Pass it to `context.actions.resource(...)` or to `.evict(...)`. Two synchronous calls produce two independent invocations, so storing one in a variable and passing it across `await` boundaries is safe.

Because the descriptor is the return value of the call (not a side-channel hidden behind it), the order and timing of `resource.user(...)` calls does not matter &mdash; the value you pass to `context.actions.resource(...)` is the one that gets fetched. No microtask windows, no "primed slot", nothing to overwrite.

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
const fiveCached: User | null = resource.user.get({ id: 5 });
```

Two callers producing structurally equal params (same key order, same primitive values) hit the same slot.

## Sync cache read

`resource.user.get(params)` reads the most recent successful payload synchronously. Returns `null` when nothing has resolved yet (whether through "never fetched" or "fetch is still pending").

Use it in the model literal to seed initial state from the cache:

```ts
const context = useContext<Model, typeof Actions>();
const actions = context.useActions({
  user: resource.user.get({ id }), // User | null
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
      ({ model }) => void (model.user = resource.user.get({ id })),
    );
  }
});
```

The cache is module-scope, so every caller of `resource.user.get({ id: 5 })` &mdash; from a model literal, a handler, even a non-React utility &mdash; sees the same payload.

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

Every Resource declaration exposes an `.action()` broadcast that fires automatically after each successful fetch, with the resolved payload as the action payload and the call-site params as the channel. The payload type is `T | null`: successful fetches broadcast `T` (as does every [local-resource](#local-resources--no-fetcher) `.set(...)`), evictions broadcast `null`. Subscribers narrow by supplying any subset of params via `.action(partial)`; matching follows the [unified channel rule](./channeled-actions.md#channel-matching) (subscriber's keys must all be satisfied by the dispatch).

```ts
// resources.ts — no manual fan-out needed; the auto-broadcast handles it.
export const user = app.Resource<User, { id: number }>((context) =>
  ky
    .get(`users/${context.params.id}`, { signal: context.controller.signal })
    .json<User>(),
);
```

```tsx
// Subscribe by useAction for handler-side reactions...
actions.useAction(user.action({ id: 5 }), (context, user) => {
  if (G.isNull(user)) {
    context.actions.produce(({ model }) => void (model.user = null));
    return;
  }
  context.actions.produce(({ model }) => void (model.user = user));
});

// ...or render the most recent value declaratively with stream.
{
  actions.stream(user.action({ id: 5 }), (value) => (
    <span>{value?.name ?? "—"}</span>
  ));
}

// No arguments — receives every fetch (and every eviction) on this Resource.
actions.useAction(user.action(), (context, user) => {
  if (G.isNotNull(user)) analytics.track(user);
});
```

Failures do not broadcast &mdash; the cache is only written on success, and the broadcast follows the same gate.

Eviction _does_ broadcast: `context.actions.resource(resource.user({ id: 5 })).evict()` (and the App-wide `context.actions.resource.nuke(where?)`) walks each cache slot the pattern matches, removes it, and dispatches `user.action(evictedParams)` with a `null` payload. That's why the payload type widens to `T | null` &mdash; a subscriber to `user.action({ id: 5 })` sees the fresh value when a fetch succeeds and `null` the moment the slot is dropped. Module-scope calls (`nuke(...)` imported directly from `march-hare`, outside a handler) still evict but do not broadcast &mdash; there's no boundary in scope to dispatch through.

The broadcast cache is sharded by `(action, channel)`, so late-mounting subscribers replay every cached entry whose channel satisfies their filter rather than just the most recent dispatch &mdash; useful for `actions.stream` panels that mount after the bulk of a page's data has already loaded. The `null` from an eviction lands in that same shard, so a late-mounting subscriber to an evicted slot sees `null` on mount rather than the stale pre-eviction value.

Two other places are still available for fan-out when the auto-broadcast isn't enough:

- **From the fetcher**, via `context.dispatch`. Useful when the broadcast needs a payload that isn't the resource value (rate-limit headroom, server-driven hints, etc.). Unicast is rejected at compile time because a fetcher has no component to deliver to.
- **From the handler**, via `context.actions.dispatch` after the `await`. Best for events that depend on the awaiter's local state &mdash; "this specific component just finished loading", model-write follow-ups, error narrowing.

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
    keys: () => Object.keys(localStorage),
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

### Per-context scoping &mdash; `Cache({ ...adapter, key })`

The default behaviour pools every tenant, session, and locale into the same set of slots &mdash; fine for single-user apps, hostile for multi-tenant ones. Add a `key(context)` callback to derive a per-context prefix from the live `<app.Boundary>` Env; the callback receives the same `{ env }` an `app.Resource` fetcher sees and its return value is prepended to every cache slot, separated by `:`. `key` is independently optional from the adapter methods: pass both for a scoped persistent cache, pass `key` on its own (`Cache<AppEnv>({ key })`) for an env-scoped in-memory cache, or omit `key` entirely. The adapter methods are an all-or-nothing group &mdash; passing a partial adapter (e.g. just `get` and `set`) is a type error.

```ts
// app.ts
type AppEnv = { session: { accessToken: string } | null };

export const app = App<AppEnv>({
  env: { session: null },
  cache: Cache<AppEnv>({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    keys: () => Object.keys(localStorage),
    key: ({ env }) => env.session?.accessToken ?? "",
  }),
});
```

A successful fetch for Alice writes to `alice:0:{...}`; Bob's writes to `bob:0:{...}`. The two coexist in the same `localStorage` without overwriting each other, and a sync read via `resource.user.get()` resolves through the same scope so Alice never sees Bob's payload.

Return `""`, `null`, or `undefined` to skip prefixing &mdash; useful for the signed-out gap, where the scope is genuinely empty. Slots written while signed out land at the top-level (`0:{...}`) and stay there even after sign-in &mdash; treat them as a separate, public tier of the cache. Evictions (`.evict()` and `.nuke()`) respect the active scope and only drop slots whose prefix matches the current env, so signing out and clearing Alice's slots does not also nuke Bob's.

> **Cross-cutting reads:** `resource.user.get(...)` is a sync read called outside any action handler, so it can't reach a fetcher's `context.env`. The `app.Boundary` keeps an internal Env reference in sync with the live Proxy on every render, and `.get()` reads through it. First-render reads run before the Boundary's commit cycle, so the very first `.get()` after mount may see the unscoped slot &mdash; subsequent renders (and any read inside an action handler) always see the scoped slot.

See the [storage recipe](./storage.md) for adapter examples (`localStorage`, MMKV, `chrome.storage`) and sign-out cache purging.

## Invalidation &mdash; `.evict()` and `.nuke()`

Cache writes happen automatically on every successful fetch; eviction is the inverse and stays explicit. Both forms use **partial-match** semantics &mdash; the supplied pattern's keys must equal the stored params' values; extra keys in the stored params are ignored. Both work against the in-memory slot **and** the persisted entries from `App({ cache })`.

### `context.actions.resource(...).evict(where?)` &mdash; per-resource

Chains off `context.actions.resource(...)` so the invocation passed in is also what's evicted. With no argument, the originating call's params become the pattern; pass `(where)` to override.

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
    user: resource.user.get({ id: context.env.userId }),
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

- **They don't refetch.** Evict + refetch is a two-step pattern; chain the next `context.actions.resource(...)` explicitly when you want a fresh load.
- **They don't cancel in-flight fetches.** A pending `await context.actions.resource(...)` finishes naturally and writes its result. Combine with `context.task.controller.abort()` if you need to discard a racing request.

### What `.evict()` and `.nuke()` _do_ auto-broadcast

Every evicted slot fires the Resource's `.action(evictedParams)` with a `null` payload, so subscribers see the drop the same way they see a fetch (`.action()` is typed `T | null`). The dispatch goes through the calling boundary, so:

- Called from a handler (via `context.actions.resource(...).evict(...)` or `context.actions.resource.nuke(...)`): broadcasts as expected.
- Called from module scope (`import { nuke } from "march-hare"`): the cache is still cleared, but no broadcast fires &mdash; there's no boundary in scope to dispatch through.

```ts
// resources.ts
export const user = app.Resource<User, { id: number }>(fetchUser);

// somewhere else — one handler subscribes, another evicts.
actions.useAction(user.action({ id: 5 }), (context, value) => {
  if (G.isNull(value)) {
    context.actions.produce(({ model }) => void (model.user = null));
    return;
  }
  context.actions.produce(({ model }) => void (model.user = value));
});

actions.useAction(Actions.SignOut, (context) => {
  context.actions.resource.nuke();
});
```

## Local resources &mdash; no fetcher

Declare a Resource with **no fetcher** to keep app-written values in the same machinery &mdash; per-params cache slots, sync `.get(params)`, the `.action()` auto-broadcast with late-mount replay, `.evict()`/`.nuke()` participation, and `App({ cache })` persistence &mdash; without an endpoint behind it:

```ts
// resources.ts
export const draft = app.Resource<Draft, { id: number }>();

// Standalone form — Env shape still leads the generics.
export const draft = shared.Resource<WebEnv, Draft, { id: number }>();
```

The declaration is the contract: **one write path per variant.** A fetched Resource's cache is a materialised view of its fetcher's results &mdash; the fetcher is the only writer, and there is no `.set()` on it. A local Resource inverts that: `.set(value)` is the only writer, and the invocation is not awaitable &mdash; there is no fetch to run, so `.exceeds(...)` and `.isolated()` don't exist on the chain. Whichever variant you're holding, a cached value's origin is never ambiguous.

```ts
actions.useAction(Actions.Save, (context, { id, text }) => {
  context.actions.resource(draft({ id })).set({ id, text });
});

actions.useAction(Actions.Discard, (context, { id }) => {
  context.actions.resource(draft({ id })).evict();
});
```

`.set(value)` walks the same sequence a successful fetch does: the cache slot is written first, then the Resource's `.action(params)` broadcast fires with the value as the payload and the call params as the channel &mdash; subscribers always observe a warm cache. Eviction broadcasts `null` per dropped slot, so the payload stays `T | null` and consumers cannot tell (and shouldn't care) whether a Resource is fetched or local:

```tsx
actions.useAction(draft.action({ id: 5 }), (context, value) => {
  context.actions.produce(({ model }) => void (model.draft = value));
});

actions.stream(draft.action({ id: 5 }), (value) => <span>{value?.text}</span>);
```

```ts
// Model literal seeding works the same as any Resource.
const actions = context.useActions({
  draft: resource.draft.get({ id: 5 }),
});
```

Persistence follows the existing rule: declare through `app.Resource` on an `App({ cache })` and every `.set(...)` writes through to the adapter, seeding back on the next reload &mdash; which is usually the whole point of a local Resource (drafts, last-selected tab, an offline queue). `shared.Resource()` is always in-memory. `context.actions.resource.nuke()` clears local slots alongside fetched ones &mdash; desirable on sign-out, but reach for a partial pattern (`nuke({ userId })`) when local values should survive.

**When not to use it:** component-local state belongs in the model, and cross-cutting ambient state (session, locale, flags) belongs in the [Env](./env.md). A local Resource earns its place when the value needs some combination of params-keyed slots, sync reads at construction time, broadcast fan-out, and persistence &mdash; not as a general key-value store.

## In-flight coalescing &mdash; the default

Concurrent callers with the same `(Resource, params)` share a single in-flight fetch automatically. No chainable, no token, no opt-in:

```ts
actions.useAction(Actions.Mount, async (context) => {
  const dashboard = await context.actions.resource(resource.dashboard());
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});

actions.useAction(Actions.Broadcast.User, async (context, payload) => {
  const dashboard = await context.actions.resource(
    resource.dashboard({ userId: payload.id }),
  );
  context.actions.produce(({ model }) => void (model.dashboard = dashboard));
});
```

If `Broadcast.User` has a cached value at mount time both handlers fire, both produce the same `Invocation`-equivalent slot, and exactly one HTTP request goes out. The shared fetch runs on a detached `AbortController`: one caller's `context.task.controller` aborting severs that caller's await but the underlying work keeps going for everyone else. When every caller has released, the shared controller is aborted too, so the network is cancelled rather than orphaned.

The dedupe key is the pair `(Resource, params)`. `resource.dashboard({ userId: 7 })` and `resource.dashboard({ userId: 8 })` are different slots and fire independent requests. See the [mount deduplication recipe](./mount-broadcast-deduplication.md) for the full pattern.

### Opting out &mdash; `.isolated()`

The only case the default doesn't cover: two callers that intentionally need **independent** fetches with byte-identical params. Chain `.isolated()` to skip the registry &mdash; the fetch fires as a fresh request against the caller's own `context.task.controller`:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  const fresh = await context.actions.resource(resource.dashboard()).isolated();
  context.actions.produce(({ model }) => void (model.dashboard = fresh));
});
```

Reach for this rarely. Almost every "I want two parallel fetches" scenario is better modelled by giving the two callers distinguishing params (a discriminator, a timestamp, a nonce) so the dedupe key splits them naturally. Mutations don't go through Resource at all &mdash; they're plain action handlers calling `ky.post`/`fetch` directly, with no coalesce layer to opt out of.

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

Concurrent `await context.actions.resource(...)` calls with the same `(Resource, params)` share a single in-flight fetch by default:

```ts
const first = context.actions.resource(resource.user({ id: 5 }));
const second = context.actions.resource(resource.user({ id: 5 }));
const third = context.actions.resource(resource.user({ id: 5 }));
await Promise.all([first, second, third]); // one network request, three resolutions
```

The shared fetch writes through to the per-params cache slot once on success. Different params (`{ id: 5 }` vs. `{ id: 6 }`) fall into different slots and fire independent requests, as do unrelated Resources. Chain [`.isolated()`](#opting-out--isolated) on a specific call to opt out for the rare case that needs an independent network request.

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

The `annotate` call drives the loading UI via `actions.inspect.user.pending()` &mdash; see [model-annotations](./model-annotations.md). Refresh has the same body: call `context.actions.resource(resource.user(...))` again.

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

- **No persistence across reloads by default.** Opt in via `App({ cache })`. The Cache writes through on every successful fetch (and every local-resource `.set(...)`) and auto-seeds from storage on first read. See [storage](./storage.md).
- **No focus or reconnect revalidation.** Wire a `window` listener and call `context.actions.resource(...)` again if you need this.
- **No SSR isolation.** The cache is module-global, so server-side rendering would leak across requests. `Resource` is client-only.
- **No subscription on the awaiter.** `await context.actions.resource(...)` resolves once and does not re-fire when a broadcast goes out. Use `useAction(broadcastAction)` for change notifications.
- **`resource.user(params)` is not reactive.** Reading it inside render does not subscribe the component to updates &mdash; it is a snapshot, not a signal. Drive UI from the model.
- **Params keying is structural via `JSON.stringify`.** Two callers must produce structurally equal params (same key order, same primitive values) to share a cache slot. Avoid `Date`, `BigInt`, `Symbol`, or non-stable object identities in params.
