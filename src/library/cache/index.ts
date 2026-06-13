import type { Adapter, Encoded, Stored } from "./types.ts";
import { empty, present, unset } from "../utils/utils.ts";
import { G } from "@mobily/ts-belt";

export type { Adapter, Encoded } from "./types.ts";

/**
 * Persistence-aware cache for a single {@link Resource}. Wraps a
 * synchronous {@link Adapter} (localStorage, MMKV, chrome.storage with a
 * sync facade, etc.) and traffics in {@link Stored} envelopes &mdash;
 * storage entries serialise as {@link Encoded}`<T>` so the
 * `Temporal.Instant` timestamp survives the string round-trip and
 * `.exceeds({...})` can short-circuit on the persisted timestamp after
 * a reload.
 *
 * Call with no arguments for an in-memory cache scoped to this
 * instance &mdash; useful for tests, ephemeral state, or when you want a
 * first-class cache object to share between Resources without
 * persistence. Pass an {@link Adapter} to back the cache with a
 * persistent store.
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
  set<T>(key: string, value: Stored<T>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<Iterable<string>>;
};

export function Cache(adapter?: Adapter): Cache {
  const memory = new Map<string, string>();
  const backing: Adapter = adapter ?? {
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
    set<T>(key: string, value: Stored<T>): Promise<void> {
      if (value.data === unset || G.isNull(value.at)) return Promise.resolve();
      try {
        return Promise.resolve(
          backing.set(
            key,
            JSON.stringify(<Encoded<T>>{
              data: value.data,
              at: value.at.toString(),
            }),
          ),
        ).catch(() => {});
      } catch {
        return Promise.resolve();
      }
    },
    remove: (key) => Promise.resolve(backing.remove(key)),
    clear: () => Promise.resolve(backing.clear()),
    keys: () => Promise.resolve(backing.keys?.() ?? []),
  };
}
