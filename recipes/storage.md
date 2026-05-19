# Persisting resources across reloads

`useResource`'s cache is a module-level `WeakMap` &ndash; everything resets on a hard reload. To survive page loads without changing every call site, March Hare ships a small storage layer that traffics in the same `Stored<T>` shape as the Resource cache. The bound handle's overloaded `.else(...)` knows how to seed itself from a `Stored<T>` fallback, so the only thing that changes at the call site is _what_ you pass to `.else`.

This recipe covers:

- The `utils.store(adapter)` factory and its `get`/`set`/`remove` API.
- The `.else(stored).else(value)` chain that hydrates the cache and falls back to a leaf.
- The `.snapshot()` getter that produces a write-ready `Stored<T>`.
- Adapter examples for browser `localStorage`, React Native MMKV, and browser-extension `chrome.storage`.
- Sign-out purge, schema versioning, and the `unset` sentinel.

## The shape: `Stored<T>`

Both `store.get(key)` and `boundHandle.snapshot()` return the same type:

```ts
type Stored<T> = {
  readonly data: T | Unset; // unset symbol when nothing is recorded
  readonly at: Temporal.Instant | null; // when the payload was recorded
  readonly else: <U>(fallback: U) => T | U;
};
```

`Unset` is a shared sentinel exported as `utils.unset` &ndash; the same one the Resource cache uses internally. It exists so a legitimately stored `null` payload is distinguishable from "nothing stored yet".

## Setting up the store

`utils.store(adapter)` wraps a synchronous key/value adapter. The adapter handles raw strings; JSON encoding and `Temporal.Instant` round-tripping happen inside the wrapper, so adapters stay trivial:

```ts
import { utils } from "march-hare";

export const store = utils.store({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
});
```

Reads return a `Stored<T>`; writes accept a `Stored<T>` and short-circuit on the empty state so a placeholder snapshot never serialises:

```ts
const stored = store.get<User>("user");
// stored.data: User | Unset
// stored.at: Temporal.Instant | null
// stored.else(null): User | null

store.set("user", boundUser.snapshot());
store.remove("user");
```

> **Why a factory, not a singleton.** `utils.store(...)` returns a fresh `Store` instance, so an app can have several &mdash; e.g. a plain `localStorage`-backed one for cached resources and a `sessionStorage`-backed one for ephemeral state &mdash; without a global setter to clash over.

## The call-site pattern

The `useResource` bound handle's `.else(...)` is overloaded:

- `.else(value: U)` &mdash; terminal. Returns the cached payload or `value`.
- `.else(stored: Stored<T>)` &mdash; chainable. If the cache is empty and the Stored carries `data` and `at`, seeds the cache from it (so subsequent `.if({ over })` calls see the persisted timestamp), then returns the same bound handle so a final `.else(value)` follows naturally.

Putting it together:

```ts
import { useActions, useResource } from "march-hare";
import { store } from "../utils.tsx";
import { Snapshots } from "./types.ts";
import { resources } from "./resources.ts";

export function useCatActions() {
  const get = { cat: useResource(resources.cat) };

  const actions = useActions<Model, typeof Actions>({
    cat: get.cat.else(store.get(Snapshots.Cat)).else(null),
  });

  actions.useAction(Actions.Mount, async (context) => {
    const data = await get.cat.if(
      { over: { minutes: 5 } },
      context.task.controller.signal,
    );
    store.set(Snapshots.Cat, get.cat.snapshot());
    context.actions.produce(({ model }) => void (model.cat = data));
  });

  return actions;
}
```

What happens on a cold reload:

1. The model literal calls `get.cat.else(store.get("cat"))`.
2. The cache is empty (fresh load). `store.get("cat")` finds the persisted entry and returns a `Stored<Cat>` with both `data` and `at` populated.
3. `.else(stored)` sees the empty cache and seeds it from the Stored.
4. `.else(null)` reads the freshly-seeded cache and returns the `Cat`.
5. The component renders the previous session's payload immediately.
6. `Mount` fires. `get.cat.if({ over: { minutes: 5 } })` checks the seeded `at`. If it's within five minutes, the fetcher _doesn't run_; otherwise it does. Either way the snapshot is written back.

> **Use a `Snapshots` enum for keys.** Pulling literal strings out into an enum keeps "what's persisted" grep-able at a glance and stops typos from silently dropping persistence on the floor. Pair the enum with the components that own each key &ndash; one enum per feature, not a global registry.

## `snapshot()` &mdash; the symmetric write side

`get.cat.snapshot()` returns a `Stored<Cat>` pointing at the bound handle's current cache slot:

- Before any successful run: `{ data: unset, at: null, else: f => f }`.
- After a successful run: `{ data: cat, at: Temporal.Instant, else: _ => cat }`.

Pass it straight to `store.set(key, ...)`. Writes with `data === unset` or `at === null` are no-ops, so calling `store.set(Snapshots.Cat, get.cat.snapshot())` before any fetch has succeeded is safe &ndash; it just doesn't write.

## Adapter examples

### React Native &mdash; `react-native-mmkv`

`AsyncStorage` is incompatible because the read path must be synchronous (the model literal is evaluated synchronously). Use `MMKV`, which is sync and fast:

```ts
import { utils } from "march-hare";
import { MMKV } from "react-native-mmkv";

const mmkv = new MMKV();

export const store = utils.store({
  get: (key) => mmkv.getString(key) ?? null,
  set: (key, value) => mmkv.set(key, value),
  remove: (key) => mmkv.delete(key),
});
```

### Browser extension &mdash; sync facade over `chrome.storage.local`

`chrome.storage.local` is async, so wrap it with an in-memory cache hydrated at startup:

```ts
import { utils } from "march-hare";

const cache = new Map<string, string>();

// Preload all keys before mounting the app. Block on this in your entry file.
export async function hydrate(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  for (const [key, value] of Object.entries(all)) {
    if (typeof value === "string") cache.set(key, value);
  }
}

export const store = utils.store({
  get: (key) => cache.get(key) ?? null,
  set: (key, value) => {
    cache.set(key, value);
    void chrome.storage.local.set({ [key]: value });
  },
  remove: (key) => {
    cache.delete(key);
    void chrome.storage.local.remove(key);
  },
});
```

### Server-rendered apps &mdash; SSR-safe localStorage

`localStorage` doesn't exist on the server. Guard with a `typeof` check so the adapter compiles in both environments:

```ts
const browser = typeof localStorage !== "undefined";

export const store = utils.store({
  get: (key) => (browser ? localStorage.getItem(key) : null),
  set: (key, value) => {
    if (browser) localStorage.setItem(key, value);
  },
  remove: (key) => {
    if (browser) localStorage.removeItem(key);
  },
});
```

On the server, reads return empty Stored handles and writes are no-ops. The model literal falls through to the leaf fallback.

## Sign-out and per-user data

Persisted entries survive sign-out by default. Clear them explicitly when the user signs out:

```ts
actions.useAction(Actions.SignOut, async (context) => {
  await api.signOut();
  store.remove(Snapshots.Cat);
  store.remove(Snapshots.User);
  // ... per persisted key
});
```

There's deliberately no `store.clear()` helper. Wiping all entries would also clear unrelated state like dismissed banners and route hints &ndash; explicit `remove` calls per known key keep the boundary clear.

## Schema drift

If the shape of `T` changes between deploys, the persisted JSON may not match the new type. Two ways to handle it:

- **Rename the key.** `Snapshots.Cat = "cat"` becomes `Snapshots.Cat = "cat-v2"`. Old entries become orphaned (no consumer reads them) and the browser will eventually evict them.
- **Validate after read.** Wrap `store.get(...)` with a parser that returns an empty Stored when the payload doesn't match the new shape:

```ts
function safeGet<T>(
  key: string,
  validate: (value: unknown) => value is T,
): Stored<T> {
  const stored = store.get<T>(key);
  if (stored.data === utils.unset) return stored;
  if (!validate(stored.data)) {
    store.remove(key); // purge corrupted entry
    return store.get(key); // re-read, now empty
  }
  return stored;
}
```

Pick whichever fits the team's release cadence &ndash; rename is simpler for one-off changes, validate is steadier for frequent schema drift.

## The `unset` sentinel

`utils.unset` is exported so consumers can narrow against it when needed:

```ts
import { utils } from "march-hare";

const stored = store.get<User | null>("maybe-user");
if (stored.data === utils.unset) {
  // No entry recorded. Distinct from `data === null`, which means a previous
  // session legitimately stored a `null` payload.
} else if (stored.data === null) {
  // The fetcher previously resolved with null and we persisted it.
} else {
  // Real User.
}
```

In practice, prefer `stored.else(fallback)` for the common case &ndash; the sentinel is there for the rare narrowing path.

## Composition: chaining multiple sources

`.else(stored)` returns the bound handle, so any number of Stored fallbacks compose &ndash; first non-empty source wins, all later ones no-op:

```ts
const session = utils.store({
  /* sessionStorage adapter */
});
const persistent = utils.store({
  /* localStorage adapter */
});

const actions = useActions<Model, typeof Actions>({
  cat: get.cat
    .else(session.get(Snapshots.Cat)) // tier 1: same-session cache
    .else(persistent.get(Snapshots.Cat)) // tier 2: cross-session cache
    .else(null), // leaf: nothing anywhere
});
```

Useful when you want fast-recover from a tab switch (sessionStorage) but a slower-but-broader fallback (localStorage) for cold loads.

## Limitations

- **Synchronous adapters only.** `.else(stored)` is evaluated inside the model literal, which runs synchronously. Async backends (`AsyncStorage`, plain `chrome.storage`, IndexedDB) need a sync facade hydrated at app entry.
- **No cross-tab coherence.** Tab A writes; tab B's in-memory cache stays stale until its own next fetch. Wire a `BroadcastChannel` listener that calls `store.get(key)` and dispatches a broadcast action if you need this.
- **No quota recovery.** If `localStorage` is full, the write silently no-ops. The Resource cache is unaffected, so the current session keeps working &ndash; the next reload just won't find a persisted entry.
- **No SSR support out of the box.** Use the `typeof localStorage !== "undefined"` guard pattern above; on the server, `.else(stored)` is always empty and the leaf fallback wins.
