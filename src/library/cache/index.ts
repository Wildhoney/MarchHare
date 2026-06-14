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
  get<T>(key: string): Stored<T>;
  set<T>(key: string, value: Stored<T>): void;
  remove(key: string): void;
  clear(): void;
  keys(): Iterable<string>;
};

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

export function Cache(adapter?: Adapter): Cache {
  const backing: Adapter = adapter ?? memoryAdapter();

  return {
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
        // ignore — quota, private mode, unserialisable payload, etc.
      }
    },
    remove(key: string): void {
      try {
        backing.remove(key);
      } catch {
        // ignore — best-effort removal
      }
    },
    clear(): void {
      try {
        backing.clear();
      } catch {
        // ignore — best-effort clear
      }
    },
    keys(): Iterable<string> {
      try {
        return backing.keys?.() ?? [];
      } catch {
        return [];
      }
    },
  };
}
