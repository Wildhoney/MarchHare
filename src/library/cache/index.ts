import type { Adapter, Encoded, Stored } from "./types.ts";
import { empty, present, unset } from "../utils/utils.ts";
import { G } from "@mobily/ts-belt";

export type { Adapter, Encoded } from "./types.ts";

/**
 * Persistence-aware cache for a single {@link Resource}. Wraps a
 * **strictly synchronous** {@link Adapter} (localStorage, MMKV,
 * chrome.storage with a sync facade, etc.) and traffics in {@link
 * Stored} envelopes &mdash; storage entries serialise as {@link
 * Encoded}`<T>` so the `Temporal.Instant` timestamp survives the
 * string round-trip and `.exceeds({...})` can short-circuit on the
 * persisted timestamp after a reload.
 *
 * Every method on the Cache is sync &mdash; the model-literal sync
 * read has no place to wait, so the adapter contract foregoes
 * `Promise` entirely. Async backends (IndexedDB, AsyncStorage,
 * `chrome.storage.local`) need a sync facade hydrated at app entry;
 * see `recipes/storage.md` for the pattern. React Native projects
 * should reach for {@link https://github.com/mrousavy/react-native-mmkv
 * `react-native-mmkv`} &mdash; it's synchronous out of the box and
 * drops straight into the Adapter contract.
 *
 * Call with no arguments for an in-memory cache scoped to this
 * instance &mdash; useful for tests, ephemeral state, or when you
 * want a first-class cache object to share between Resources without
 * persistence. Pass an {@link Adapter} to back the cache with a
 * persistent store; when supplied, the adapter is the **only** tier
 * &mdash; the Cache does not maintain a separate in-memory mirror.
 *
 * @example
 * ```ts
 * // In-memory, scoped to this instance.
 * const cache = Cache();
 *
 * // Persisted via localStorage.
 * const cache = Cache({
 *   get: (key) => localStorage.getItem(key),
 *   set: (key, value) => localStorage.setItem(key, value),
 *   remove: (key) => localStorage.removeItem(key),
 *   clear: () => localStorage.clear(),
 * });
 *
 * // Wire it into a Resource — successful runs write through automatically.
 * export const cat = Resource({
 *   cache,
 *   fetch: (context) => fetchCat(context.controller.signal),
 * });
 * ```
 */
export type Cache = {
  /**
   * Returns the {@link Stored} envelope for `key`. The envelope is
   * `empty()` when nothing is persisted; otherwise it carries the
   * decoded payload and the timestamp recorded at write-time.
   *
   * @template T The payload type expected at `key`.
   * @param key Cache slot identifier &mdash; usually the JSON-stringified
   *   call-site params, prefixed by the Resource's namespace.
   */
  get<T>(key: string): Stored<T>;
  /**
   * Writes `value` to `key`. Skipped when the envelope has no concrete
   * payload (e.g. an `empty()` slot), since there is nothing meaningful
   * to persist. Serialisation, quota errors, and unserialisable payloads
   * are swallowed &mdash; writes are best-effort.
   *
   * @template T The payload type contained in `value`.
   * @param key Cache slot identifier &mdash; usually the JSON-stringified
   *   call-site params, prefixed by the Resource's namespace.
   * @param value Stored envelope carrying the payload and its
   *   write-time `Temporal.Instant`.
   */
  set<T>(key: string, value: Stored<T>): void;
  /**
   * Drops a single cache slot. Best-effort &mdash; backing-store errors
   * are swallowed.
   *
   * @param key Cache slot identifier.
   */
  remove(key: string): void;
  /**
   * Drops every cache slot in the backing store. Best-effort &mdash;
   * backing-store errors are swallowed.
   */
  clear(): void;
  /**
   * Returns every key currently held by the backing store. Used by
   * partial-match eviction (`evict(where)`) to iterate slots whose
   * stored params satisfy a `where` pattern.
   */
  keys(): Iterable<string>;
};

/**
 * In-memory {@link Adapter} backed by a `Map`. Created on demand inside
 * {@link Cache} when no adapter is supplied; tests and ephemeral use
 * cases get an isolated slot without touching storage.
 *
 * @internal
 */
function memoryAdapter(): Adapter {
  const memory = new Map<string, string>();
  return {
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => {
      memory.set(key, value);
    },
    remove: (key) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
    keys: () => memory.keys(),
  };
}

/**
 * Constructs a {@link Cache} backed by `adapter`, or by an in-memory
 * `Map` when none is supplied. The returned object is the same shape
 * regardless &mdash; only the durability differs.
 *
 * @param adapter Optional synchronous backing store (localStorage, MMKV,
 *   or a custom sync facade). Omit for an in-memory cache scoped to
 *   this instance.
 */
export function Cache(adapter?: Adapter): Cache {
  const backing: Adapter = adapter ?? memoryAdapter();

  return {
    /**
     * Reads `key` from the backing store, parses the {@link Encoded}
     * envelope, and re-hydrates the `Temporal.Instant`. Returns
     * `empty()` when the slot is missing or the stored JSON is
     * malformed.
     */
    get<T>(key: string): Stored<T> {
      try {
        const raw = backing.get(key);
        if (G.isNull(raw)) return empty<T>();
        const parsed = <Encoded<T>>JSON.parse(raw);
        return present(parsed.data, Temporal.Instant.from(parsed.at));
      } catch {
        return empty<T>();
      }
    },
    /**
     * Serialises `value` to JSON and writes it under `key`. Skips
     * envelopes whose payload is unset or whose timestamp is missing,
     * and swallows quota / encoding / private-mode errors.
     */
    set<T>(key: string, value: Stored<T>): void {
      if (value.data === unset || G.isNull(value.at)) return;
      try {
        backing.set(
          key,
          JSON.stringify(<Encoded<T>>{
            data: value.data,
            at: value.at.toString(),
          }),
        );
      } catch {
        return;
      }
    },
    /**
     * Removes a single slot. Backing-store errors are swallowed
     * &mdash; eviction is best-effort.
     */
    remove(key: string): void {
      try {
        backing.remove(key);
      } catch {
        return;
      }
    },
    /**
     * Clears every slot in the backing store. Backing-store errors are
     * swallowed &mdash; clear is best-effort.
     */
    clear(): void {
      try {
        backing.clear();
      } catch {
        return;
      }
    },
    /**
     * Returns every key the backing store currently holds, or an empty
     * iterable when the adapter does not expose `keys` (legacy adapters)
     * or throws while enumerating.
     */
    keys(): Iterable<string> {
      try {
        return backing.keys?.() ?? [];
      } catch {
        return [];
      }
    },
  };
}
