export type { Stored } from "../utils/types.ts";

/**
 * On-disk JSON shape of a `Stored` envelope. The Cache wrapper
 * encodes a populated Stored as `{ data, at: at.toString() }` so the
 * `Temporal.Instant` survives the string round-trip, and decodes via
 * `Temporal.Instant.from(...)` on read. Adapters never see this shape
 * directly &mdash; they shuttle the already-stringified JSON.
 *
 * @template T The payload type carried by the matching {@link Stored}.
 */
export type Encoded<T> = {
  readonly data: T;
  readonly at: string;
};

/**
 * Adapter contract for synchronous key/value storage. Implement once per
 * backend (localStorage, MMKV on React Native, chrome.storage with a sync
 * facade, etc.) and pass to {@link Cache}. The adapter shuttles raw
 * strings; JSON encoding and `Temporal.Instant` round-tripping happen
 * inside the Cache wrapper, so adapters stay trivial.
 */
export type Adapter = {
  /**
   * Return the raw string stored under `key`, or `null` when no entry
   * exists. **Sync only** &mdash; the model-literal sync read requires
   * an immediate answer. Async backends (React Native AsyncStorage,
   * IndexedDB, etc.) need a sync facade hydrated at app entry; see
   * `recipes/storage.md` for the pattern. Treat any read-time error
   * (decryption, IPC, etc.) as "not found" and return `null`.
   */
  readonly get: (key: string) => string | null;
  /**
   * Persist the raw string `value` under `key`. May return `void` for
   * sync backends or `Promise<void>` for async ones (RN AsyncStorage,
   * IndexedDB). The Cache awaits the result before resolving its own
   * `set` so callers know the write has settled when their `await`
   * returns. Throwing (or rejecting) is fine on quota, private mode,
   * sandboxed iframes, etc.; the Cache catches and swallows so a write
   * failure can't poison an already-resolved fetch.
   */
  readonly set: (key: string, value: string) => void | Promise<void>;
  /**
   * Drop the entry at `key`. May return `void` or `Promise<void>`.
   * Idempotent &mdash; calling `remove` for a key that isn't present
   * must not throw.
   */
  readonly remove: (key: string) => void | Promise<void>;
  /**
   * Wipe every entry this adapter can see. May return `void` or
   * `Promise<void>`. On a shared backend such as `localStorage` this
   * means the whole origin &mdash; third-party SDK state, dismissed
   * banners, route hints, etc. all go with it. Adapter authors should
   * either delegate to the backend's native clear (accepting that
   * scope) or namespace by key prefix and remove only their own.
   */
  readonly clear: () => void | Promise<void>;
  /**
   * Optional enumerator over every key the adapter currently knows
   * about. May yield sync or via a `Promise`. When present,
   * partial-match evictions can sweep entries written in previous
   * sessions; when absent, eviction is limited to keys touched by the
   * current session. `localStorage` exposes this via
   * `Object.keys(localStorage)`, MMKV via `getAllKeys()`, and
   * AsyncStorage via `getAllKeys(): Promise<readonly string[]>`.
   */
  readonly keys?: () =>
    | Iterable<string>
    | Promise<Iterable<string> | readonly string[]>;
};
