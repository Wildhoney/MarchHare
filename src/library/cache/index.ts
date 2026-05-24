import type { Adapter, Encoded, Stored } from "./types.ts";
import { empty, present, unset } from "../utils/utils.ts";

export type { Adapter, Encoded } from "./types.ts";

/**
 * Persistence-aware cache for a single {@link Resource}. Wraps a
 * synchronous {@link Adapter} (localStorage, MMKV, chrome.storage with a
 * sync facade, etc.) and traffics in {@link Stored} envelopes &mdash;
 * Storage entries serialise as {@link Encoded}`<T>` so the
 * `Temporal.Instant` timestamp survives the string round-trip and
 * `Bundle.run.if({ over })` can short-circuit on the persisted
 * timestamp after a reload.
 *
 * Construct with no arguments for an in-memory cache scoped to this
 * instance &mdash; useful for tests, ephemeral state, or when you want a
 * first-class cache object to share between Resources without
 * persistence. Pass an {@link Adapter} to back the cache with a
 * persistent store.
 *
 * @example
 * ```ts
 * // In-memory, scoped to this instance.
 * const cache = new Cache();
 *
 * // Persisted via localStorage.
 * const cache = new Cache({
 *   get: (key) => localStorage.getItem(key),
 *   set: (key, value) => localStorage.setItem(key, value),
 *   remove: (key) => localStorage.removeItem(key),
 *   clear: () => localStorage.clear(),
 * });
 *
 * // Wired into a Resource — successful runs write through automatically.
 * export const resources = {
 *   cat: Resource(async (signal) => fetchCat(signal), cache),
 * };
 * ```
 */
export class Cache {
  private adapter: Adapter;
  private memory: Map<string, string> = new Map();

  constructor(adapter?: Adapter) {
    this.adapter = adapter ?? {
      get: (key) => this.memory.get(key) ?? null,
      set: (key, value) => {
        this.memory.set(key, value);
      },
      remove: (key) => {
        this.memory.delete(key);
      },
      clear: () => {
        this.memory.clear();
      },
    };
  }

  get<T>(key: string): Stored<T> {
    try {
      const raw = this.adapter.get(key);
      if (raw === null) return empty<T>();
      const parsed = <Encoded<T>>JSON.parse(raw);
      return present(parsed.data, Temporal.Instant.from(parsed.at));
    } catch {
      return empty<T>();
    }
  }

  set<T>(key: string, value: Stored<T>): boolean {
    if (value.data === unset || value.at === null) return false;
    try {
      this.adapter.set(
        key,
        JSON.stringify(<Encoded<T>>{
          data: value.data,
          at: value.at.toString(),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    this.adapter.remove(key);
  }

  clear(): void {
    this.adapter.clear();
  }
}
