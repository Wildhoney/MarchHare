# Persisting resources across reloads

By default a `Resource`'s cache is in-memory only &ndash; it resets on every page load. To keep the most recent successful payload around between sessions, wire a `Cache` into `App({ cache })`. Every `app.Resource` declaration on that App shares the cache: writes go through on every successful fetch, and the per-params slot seeds from storage on first read, so call sites stay free of explicit `cache.set` / `cache.get` ceremony.

This recipe covers:

- The `Cache(adapter)` factory and its `get`/`set`/`remove`/`clear` API &mdash; **every method is strictly synchronous**.
- `App({ cache })` &mdash; the single place to wire persistence for every resource on an App.
- Adapter examples for browser `localStorage`, React Native via [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv), and browser-extension `chrome.storage`.
- Sign-out purge, schema versioning, and the `unset` sentinel.

> **Sync only.** The adapter contract has no `Promise<...>` anywhere. The model-literal read (`{ user: resource.user.get() }`) is evaluated in the current tick during render &ndash; there's no `await` to lean on. Truly async backends (IndexedDB, AsyncStorage, `chrome.storage.local`) need a synchronous facade hydrated at app entry; the chrome.storage example below shows the pattern. React Native projects should reach for [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv), which is sync out of the box and drops straight into the `Adapter` contract.

## The shape: `Stored<T>`

`cache.get(key)` returns a `Stored<T>`:

```ts
type Stored<T> = {
  readonly data: T | Unset; // unset symbol when nothing is recorded
  readonly at: Temporal.Instant | null; // when the payload was recorded
};
```

`Unset` is a shared sentinel exported as `utils.unset` &ndash; it exists so a legitimately stored `null` payload is distinguishable from "nothing stored yet".

## Setting up the Cache

`Cache(adapter)` wraps a synchronous key/value adapter. The adapter handles raw strings; JSON encoding and `Temporal.Instant` round-tripping happen inside the Cache, so adapters stay trivial:

```ts
import { Cache } from "march-hare";

const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});
```

`Cache()` with no adapter is in-memory only &ndash; useful in tests or when you want a first-class, holdable cache without persistence. When an adapter **is** supplied, the adapter is the only tier &ndash; the Cache does not also maintain a separate in-memory mirror.

Add a `key(context)` callback alongside the adapter methods to scope every slot by the live per-`<app.Boundary>` Env &ndash; useful for sharing a single backing store across tenants, sessions, or locales without overlap:

```ts
type AppEnv = { session: { accessToken: string } | null };

const cache = Cache<AppEnv>({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
  key: ({ env }) => env.session?.accessToken ?? "",
});
```

The callback receives the same `{ env }` an `app.Resource` fetcher sees; its return value is prepended (separated by `:`) to every cache key. Return `""`, `null`, or `undefined` to skip prefixing &mdash; the signed-out gap then writes to the top-level (unscoped) tier. Evictions stay scoped to the active Env, so signing out and clearing one user's slots does not also nuke another's. See the [scoped cache section in the Resource recipe](./use-resource.md#per-context-scoping--cache-adapter-key) for the resource-side semantics and the first-render caveat.

Every Cache method is sync. Reads return a `Stored<T>` immediately; writes (`set`, `remove`, `clear`) return `void`. Empty `Stored`s are no-ops on write so placeholder snapshots never serialise:

```ts
const stored = cache.get<User>("user");
// stored.data: User | Unset — branch on `=== unset` to distinguish empty from null
// stored.at: Temporal.Instant | null

cache.set("user", { data: user, at: Temporal.Now.instant() });
cache.remove("user");
cache.clear();
```

## Wiring a Cache into the App

Attach a Cache once on `App({ cache })`. Every `app.Resource(fetcher)` declared against that App shares the cache, namespaced internally by declaration order so two resources called with the same params don't collide on the same adapter slot:

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
// resources.ts
import ky from "ky";
import { app } from "./app";
import type { Cat } from "./types";

export const cat = app.Resource(async (context) => {
  const cats = await ky
    .get("https://api.thecatapi.com/v1/images/search", {
      signal: context.controller.signal,
    })
    .json<Cat[]>();
  return cats[0];
});
```

```ts
// actions.ts
import { app } from "./app";
import * as resource from "./resources";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({
    // First render reads the Cache automatically — no explicit get.
    cat: resource.cat.get(),
  });

  actions.useAction(Actions.Mount, async (context) => {
    // Short-circuits when the persisted payload is < 5 minutes old.
    // The Cache writes through automatically — no explicit set.
    const cat = await context.actions
      .resource(resource.cat())
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.cat = cat));
  });

  return actions;
}
```

What happens on a cold reload:

1. The model literal calls `resource.cat.get()`.
2. The Cache reads from the adapter using the params key (here `"{}"` since `cat` is no-params).
3. If a previous session persisted a payload, the call returns it.
4. The component renders the previous session's payload immediately.
5. `Mount` fires. `context.actions.resource(resource.cat()).exceeds({ minutes: 5 })` checks the persisted `at`. If it's within five minutes, the fetcher _doesn't run_; otherwise it does. On a successful fetch, the Cache writes through.

> **One Cache per App.** All `app.Resource` declarations share `App({ cache })`. Each resource is isolated inside the cache via a module-evaluation-order namespace, so two resources called with the same params still resolve to distinct adapter slots and reload-seeding lines up across page loads. Reach for separate `App()` instances when you genuinely need isolated caches.

## Per-params keying

Cache entries are keyed automatically by `JSON.stringify(params)`, prefixed with the resource's declaration-order namespace inside the App's cache. For a parameterised resource like `resource.user({ id: 5 })`, the per-params suffix is `"{\"id\":5}"`. Different params produce independent persistent slots:

```ts
export const user = app.Resource<User, { id: number }>((context) =>
  ky
    .get(`users/${context.params.id}`, {
      signal: context.controller.signal,
    })
    .json<User>(),
);

// Each cache slot is independent.
await context.actions.resource(resource.user({ id: 5 })); // stored under "<ns>:{\"id\":5}"
await context.actions.resource(resource.user({ id: 6 })); // stored under "<ns>:{\"id\":6}"

// Sync reads pull from each slot.
const five: User | null = resource.user.get({ id: 5 });
const six: User | null = resource.user.get({ id: 6 });
```

## Adapter examples

### React Native &mdash; [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv) (recommended)

MMKV is the recommended React Native backend. It's synchronous out of the box, fast, and JSI-backed &ndash; no bridge round-trips, no `Promise` ceremony. `AsyncStorage` is incompatible with the Cache because the read path must be sync (the model literal is evaluated synchronously during render); MMKV avoids that constraint entirely.

```bash
npm install react-native-mmkv
```

```ts
import { Cache } from "march-hare";
import { MMKV } from "react-native-mmkv";

const mmkv = new MMKV();

export const cache = Cache({
  get: (key) => mmkv.getString(key) ?? null,
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => mmkv.delete(key),
  clear: () => mmkv.clearAll(),
  keys: () => mmkv.getAllKeys(),
});
```

See the [`react-native-mmkv` README](https://github.com/mrousavy/react-native-mmkv) for encryption, multiple instances, and lifecycle notes.

### Browser &mdash; `localStorage`

`localStorage` is synchronous and ubiquitous; the simplest production-grade backend for the web:

```ts
import { Cache } from "march-hare";

export const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
  keys: () => Object.keys(localStorage),
});
```

### Browser extension &mdash; sync facade over `chrome.storage.local`

`chrome.storage.local` is async, so wrap it with an in-memory map hydrated at startup. Hydrate **before** mounting `<Boundary>` so the model-literal read sees the persisted values:

```ts
import { Cache } from "march-hare";

const memory = new Map<string, string>();

export async function hydrate(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(all)) {
    if (typeof value === "string") memory.set(key, value);
  }
}

export const cache = Cache({
  get: (key) => memory.get(key) ?? null,
  set: (key, value) => {
    memory.set(key, value);
    void chrome.storage.local.set({ [key]: value });
  },
  remove: (key) => {
    memory.delete(key);
    void chrome.storage.local.remove(key);
  },
  clear: () => {
    memory.clear();
    void chrome.storage.local.clear();
  },
  keys: () => memory.keys(),
});
```

```ts
// app entry point
await hydrate();
createRoot(node).render(<Boundary>{/* … */}</Boundary>);
```

The persistent backend stays async; the **adapter** exposed to the Cache is sync because every read hits the hydrated `memory` map. Writes update the map in-line and fire-and-forget into `chrome.storage.local` &ndash; the Cache never awaits the persistent write.

### Server-rendered apps &mdash; SSR-safe localStorage

```ts
const browser = typeof localStorage !== "undefined";

export const cache = Cache({
  get: (key) => (browser ? localStorage.getItem(key) : null),
  set: (key, value) => {
    if (browser) localStorage.setItem(key, value);
  },
  remove: (key) => {
    if (browser) localStorage.removeItem(key);
  },
  clear: () => {
    if (browser) localStorage.clear();
  },
});
```

On the server, reads return empty Stored handles and writes are no-ops.

## Sign-out and per-user data

Persisted entries survive sign-out by default. Hold a reference to the App's cache (or import it via `app`-adjacent module) and clear it explicitly when the user signs out:

```ts
import { cache } from "./app";

actions.useAction(Actions.SignOut, async (context) => {
  await context.actions.resource(resource.signOut());
  context.actions.produce(({ env }) => {
    env.session = null;
  });
  cache.clear();
});
```

To purge a single resource entry instead of the whole App cache, reach for `context.actions.resource(resource.user(params)).evict()` &mdash; see [`evict()` below](#evicting-a-cache-entry).

## Evicting a cache entry

Inside an action handler, chain `.evict(where?)` on `context.actions.resource(...)` to remove cache entries by partial-match pattern. With no argument, the call's own params become the pattern. With an argument, partial-match drops every stored entry whose params satisfy the supplied keys (extras are ignored):

```ts
actions.useAction(Actions.UserDeleted, (context, { id }) => {
  context.actions.resource(resource.user({ id })).evict();
});

actions.useAction(Actions.TeamUpdated, (context, { teamId }) => {
  context.actions.resource(resource.user()).evict({ teamId });
});
```

For a sweep across every resource on the App, call `context.actions.resource.nuke(where?)` &mdash; same partial-match logic, broader scope. Both `evict` and `nuke` are synchronous &mdash; they settle in the current tick because the adapter contract is sync. Partial-match enumeration uses the adapter's `keys()` when implemented.

## Schema drift

If the shape of `T` changes between deploys, the persisted JSON may not match the new type. Validate the parsed payload after the Cache read &mdash; wrap your fetcher so the slot is repopulated on the next call, or chain `context.actions.resource(resource.user(params)).evict()` from a one-shot migration handler to wipe the stale entry.

## The `unset` sentinel

`utils.unset` is exported so consumers can narrow against it:

```ts
import { utils } from "march-hare";

const stored = cache.get<User | null>("maybe-user");
if (stored.data === utils.unset) {
  // No entry recorded.
} else if (stored.data === null) {
  // Persisted null payload.
} else {
  // Real User.
}
```

## Limitations

- **Synchronous adapters only.** The Cache reads during render (via the model literal). Async backends need a sync facade hydrated at app entry &mdash; React Native users should use [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv) to avoid this entirely.
- **No cross-tab coherence.** Tab A writes; tab B's in-memory state stays stale until its own next fetch. Wire a `BroadcastChannel` listener if you need this.
- **No quota recovery.** If `localStorage` is full, the write silently no-ops (the Cache catches the throw).
- **No SSR support out of the box.** Use the `typeof localStorage !== "undefined"` guard pattern.
