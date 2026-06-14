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
 *
 * **Every method is strictly synchronous.** The library never awaits
 * adapter calls &mdash; the model-literal sync read has no place to
 * wait. Async backends (IndexedDB, AsyncStorage, chrome.storage.local)
 * need a sync facade hydrated at app entry; see `recipes/storage.md`
 * for the pattern. React Native projects should use
 * {@link https://github.com/mrousavy/react-native-mmkv `react-native-mmkv`}
 * &mdash; it's sync out of the box and drops straight into this
 * contract.
 */
export type Adapter = {
  /**
   * Return the raw string stored under `key`, or `null` when no entry
   * exists. **Strictly sync.** Treat any read-time error (decryption,
   * IPC, etc.) as "not found" and return `null` &mdash; the Cache will
   * fall back to its empty state.
   */
  readonly get: (key: string) => string | null;
  /**
   * Persist the raw string `value` under `key`. **Strictly sync.**
   * Throwing is fine on quota, private mode, sandboxed iframes, etc.;
   * the Cache catches and swallows so a failure can't poison an
   * already-resolved fetch.
   */
  readonly set: (key: string, value: string) => void;
  /**
   * Drop the entry at `key`. **Strictly sync.** Idempotent &mdash;
   * calling `remove` for a key that isn't present must not throw.
   */
  readonly remove: (key: string) => void;
  /**
   * Wipe every entry this adapter can see. **Strictly sync.** On a
   * shared backend such as `localStorage` this means the whole origin
   * &mdash; third-party SDK state, dismissed banners, route hints, etc.
   * all go with it. Adapter authors should either delegate to the
   * backend's native clear (accepting that scope) or namespace by key
   * prefix and remove only their own.
   */
  readonly clear: () => void;
  /**
   * Optional enumerator over every key the adapter currently knows
   * about. **Strictly sync** when implemented &mdash; partial-match
   * evictions sweep these keys in the current tick. `localStorage`
   * exposes this via `Object.keys(localStorage)`; MMKV via
   * `getAllKeys()`.
   */
  readonly keys?: () => Iterable<string>;
};
