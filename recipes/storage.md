# Persisting resources across reloads

By default a `Resource`'s cache is in-memory only &ndash; it resets on every page load. To keep the most recent successful payload around between sessions, wire a `Cache` instance to the `Resource` definition. The Cache writes through to its adapter on every successful fetch and seeds the per-params slot from storage on first read, so call sites stay free of explicit `store.set` / `store.get` ceremony.

This recipe covers:

- The `new Cache(adapter)` constructor and its `get`/`set`/`remove`/`clear` API.
- The `Resource(fetcher, cache)` second argument that wires a Resource to a Cache.
- Adapter examples for browser `localStorage`, React Native MMKV, and browser-extension `chrome.storage`.
- Sign-out purge, schema versioning, and the `unset` sentinel.

## The shape: `Stored<T>`

`cache.get(key)` returns a `Stored<T>`:

```ts
type Stored<T> = {
  readonly data: T | Unset; // unset symbol when nothing is recorded
  readonly at: Temporal.Instant | null; // when the payload was recorded
  readonly else: <U>(fallback: U) => T | U;
};
```

`Unset` is a shared sentinel exported as `utils.unset` &ndash; it exists so a legitimately stored `null` payload is distinguishable from "nothing stored yet".

## Setting up the Cache

`new Cache(adapter)` wraps a synchronous key/value adapter. The adapter handles raw strings; JSON encoding and `Temporal.Instant` round-tripping happen inside the Cache, so adapters stay trivial:

```ts
import { Cache } from "march-hare";

const cache = new Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});
```

`new Cache()` with no adapter is in-memory only &ndash; useful in tests or when you want a first-class, holdable cache without persistence.

Reads return a `Stored<T>`; writes accept a `Stored<T>` and short-circuit on the empty state so a placeholder snapshot never serialises:

```ts
const stored = cache.get<User>("user");
// stored.data: User | Unset
// stored.at: Temporal.Instant | null
// stored.else(null): User | null

cache.set("user", { data: user, at: Temporal.Now.instant(), else: () => user });
cache.remove("user");
cache.clear();
```

## Wiring a Cache into a Resource

Pass the `Cache` as the second argument to `Resource(fetcher, cache)`. Every successful fetch writes through to the Cache under a key derived from the call-site params; first reads via `.get(params)` auto-seed from the Cache's adapter. The pattern collapses to:

```ts
// resources.ts
import ky from "ky";
import { Cache, Resource } from "march-hare";
import type { Cat } from "./types";

const cache = new Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const cat = Resource(async ({ signal }) => {
  const cats = await ky
    .get("https://api.thecatapi.com/v1/images/search", { signal })
    .json<Cat[]>();
  return cats[0];
}, cache);
```

```ts
// actions.ts
import { useActions } from "march-hare";
import * as resource from "./resources";

export function useCatActions() {
  const actions = useActions<Model, typeof Actions>({
    // First render reads the Cache automatically — no explicit get.
    cat: resource.cat.get(),
  });

  actions.useAction(Actions.Mount, async (context) => {
    // Short-circuits when the persisted payload is < 5 minutes old.
    // The Cache writes through automatically — no explicit set.
    const data = await context.actions
      .resource(resource.cat)
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.cat = data));
  });

  return actions;
}
```

What happens on a cold reload:

1. The model literal calls `resource.cat.get()`.
2. The Cache reads from the adapter using the params key (here `"{}"` since `cat` is no-params).
3. If a previous session persisted a payload, `.get()` returns it.
4. The component renders the previous session's payload immediately.
5. `Mount` fires. `context.actions.resource(resource.cat).exceeds({ minutes: 5 })` checks the persisted `at`. If it's within five minutes, the fetcher _doesn't run_; otherwise it does. On a successful fetch, the Cache writes through.

> **One Cache per Resource is the default.** The Cache's whole adapter namespace belongs to the Resource it's wired to &mdash; different Resources should each declare their own Cache (with a distinct prefix in the adapter if sharing one backing store like `localStorage`).

## Per-params keying

Cache entries are keyed automatically by `JSON.stringify(params)`. For a parameterised resource like `user.get({ id: 5 })`, the storage key is `"{\"id\":5}"`. Different params produce independent persistent slots:

```ts
const userCache = new Cache(namespacedAdapter("users"));
export const user = Resource(
  ({ signal, params }: FetcherArgs<{ id: number }>) =>
    ky.get(`users/${params.id}`, { signal }).json<User>(),
  userCache,
);

// Each cache slot is independent.
await context.actions.resource(user, { id: 5 }); // stored under "{\"id\":5}"
await context.actions.resource(user, { id: 6 }); // stored under "{\"id\":6}"

// Sync reads pull from each slot.
const five: User | null = user.get({ id: 5 });
const six: User | null = user.get({ id: 6 });
```

If you want to namespace by resource name when sharing a backing store, prefix in the adapter:

```ts
function namespacedAdapter(prefix: string): Adapter {
  return {
    get: (key) => localStorage.getItem(`${prefix}/${key}`),
    set: (key, value) => localStorage.setItem(`${prefix}/${key}`, value),
    remove: (key) => localStorage.removeItem(`${prefix}/${key}`),
    clear: () => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(`${prefix}/`)) localStorage.removeItem(k);
      }
    },
  };
}

const catCache = new Cache(namespacedAdapter("cat"));
const userCache = new Cache(namespacedAdapter("user"));
```

## Adapter examples

### React Native &mdash; `react-native-mmkv`

`AsyncStorage` is incompatible because the read path must be synchronous (the model literal is evaluated synchronously). Use `MMKV`:

```ts
import { Cache } from "march-hare";
import { MMKV } from "react-native-mmkv";

const mmkv = new MMKV();

export const cache = new Cache({
  get: (key) => mmkv.getString(key) ?? null,
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => mmkv.delete(key),
  clear: () => mmkv.clearAll(),
});
```

### Browser extension &mdash; sync facade over `chrome.storage.local`

`chrome.storage.local` is async, so wrap it with an in-memory cache hydrated at startup:

```ts
import { Cache } from "march-hare";

const memory = new Map<string, string>();

export async function hydrate(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(all)) {
    if (typeof value === "string") memory.set(key, value);
  }
}

export const cache = new Cache({
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
});
```

### Server-rendered apps &mdash; SSR-safe localStorage

```ts
const browser = typeof localStorage !== "undefined";

export const cache = new Cache({
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

Persisted entries survive sign-out by default. Clear them explicitly when the user signs out:

```ts
actions.useAction(Actions.SignOut, async (context) => {
  await context.actions.resource(resource.signOut);
  context.actions.produce(({ store }) => {
    store.session = null;
  });
  catCache.clear();
  userCache.clear();
});
```

## Schema drift

If the shape of `T` changes between deploys, the persisted JSON may not match the new type. Two ways to handle it:

- **Bump the adapter namespace.** Change `namespacedAdapter("cat")` to `namespacedAdapter("cat-v2")`. Old entries become orphaned and the browser will eventually evict them.
- **Validate after read.** Wrap the Cache's read with a parser that returns an empty Stored when the payload doesn't match the new shape.

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

- **Synchronous adapters only.** The Cache reads during render (via the model literal). Async backends need a sync facade hydrated at app entry.
- **No cross-tab coherence.** Tab A writes; tab B's in-memory state stays stale until its own next fetch. Wire a `BroadcastChannel` listener if you need this.
- **No quota recovery.** If `localStorage` is full, the write silently no-ops (the Cache catches the throw). The in-memory slot is unaffected.
- **No SSR support out of the box.** Use the `typeof localStorage !== "undefined"` guard pattern.
