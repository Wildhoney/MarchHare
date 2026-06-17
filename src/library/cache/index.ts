import type { Adapter, Encoded, Stored } from "./types.ts";
import type { Env } from "../boundary/components/env/types.ts";
import { empty, present, unset } from "../utils/utils.ts";
import { G } from "@mobily/ts-belt";

export type { Adapter, Encoded } from "./types.ts";

/**
 * Context passed to {@link CacheConfig.key}. Mirrors the shape an
 * `app.Resource` fetcher receives, restricted to the field the cache
 * needs to scope on: the live per-`<Boundary>` Env. Future-extensible
 * &mdash; new fields can land here without breaking the call shape.
 *
 * @template E The Env shape the cache is parameterised by.
 */
export type CacheContext<E extends object> = {
  readonly env: E;
};

/**
 * Configuration accepted by the {@link Cache} factory. Combines the
 * synchronous {@link Adapter} (`get`/`set`/`remove`/`clear`/`keys?`)
 * with an optional `key(context)` callback in a single flat object,
 * so all the cache's plumbing lives in one literal at the call site.
 *
 * - `key` &mdash; derives a per-context cache scope. Called every time
 *   a cache key is assembled with the same `{ env }` shape an
 *   `app.Resource` fetcher receives; the returned string is prepended
 *   to the per-resource namespace and params so different scopes
 *   (e.g. one cache slot per access token, locale, or tenant id) can
 *   coexist in the same backing store. Return `""`, `null`, or
 *   `undefined` to skip prefixing &mdash; useful for "not signed in"
 *   gaps where the scope is genuinely empty.
 */
export type CacheConfig<E extends object> = Adapter & {
  readonly key?: (context: CacheContext<E>) => string | null | undefined;
};

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
 * Pass `key(context)` alongside the adapter methods to scope cache
 * slots by the per-`<Boundary>` Env. The returned string is prepended
 * to every cache key the Resource layer assembles, so different
 * tenants / sessions / locales share the adapter without stepping on
 * each other.
 *
 * The `E` generic lives on the {@link Cache} factory and on
 * {@link CacheConfig}: it parameterises the `key(context)` callback
 * at construction time so the caller can read `context.env.X` with
 * full typing. The returned {@link Cache} value is itself
 * env-agnostic &mdash; the runtime `scope(env)` method takes the
 * loose {@link Env} record and narrows internally before invoking
 * the callback &mdash; which keeps it freely assignable across
 * differently-typed Apps without variance gymnastics.
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
 * // Multi-tenant: writes go under `${accessToken}:…`.
 * type AppEnv = { session: { accessToken: string } | null };
 * const cache = Cache<AppEnv>({
 *   get: (key) => localStorage.getItem(key),
 *   set: (key, value) => localStorage.setItem(key, value),
 *   remove: (key) => localStorage.removeItem(key),
 *   clear: () => localStorage.clear(),
 *   key: ({ env }) => env.session?.accessToken ?? "",
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
  /**
   * Returns the per-context prefix derived from the configured
   * `key(context)`. The returned string is appended with `:` by the
   * Resource layer to compose the full cache key. Always `""` when
   * no `key` option was supplied or when the callback returned an
   * empty value &mdash; "no scope" is encoded as the empty string.
   *
   * Takes the loose {@link Env} record at runtime &mdash; the typed
   * `E` lives on the `key(context)` callback registered at
   * construction time, which the cache narrows to `E` internally
   * before invoking.
   *
   * @internal Public surface lives on the Resource layer; consumers
   *   should not need to call this directly.
   */
  scope(env: Env | undefined): string;
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
 * Constructs a {@link Cache} from `config`. The config object carries
 * the synchronous adapter methods (`get`/`set`/`remove`/`clear`/`keys?`)
 * and, optionally, a `key(context)` callback that scopes every cache
 * slot by the live per-`<Boundary>` Env. Omit `config` entirely for an
 * in-memory cache scoped to this instance.
 *
 * When `key` is supplied, it runs each time the Resource layer
 * assembles a cache key, receiving the same `{ env }` shape an
 * `app.Resource` fetcher sees; its return value is prepended
 * (separated by `:`) to the per-resource namespace and params JSON.
 *
 * @template E The Env shape `config.key` is typed against. Defaults
 *   to the loose {@link Env} record so callers that don't scope by
 *   env can keep using `Cache({ ...adapter })` without supplying a
 *   generic.
 * @param config Optional adapter-plus-options literal. Omit for an
 *   in-memory cache; supply adapter methods alone for a persisted
 *   cache; add `key` to also scope writes by the live Env.
 */
export function Cache<E extends object = Env>(config?: CacheConfig<E>): Cache {
  const backing: Adapter = G.isUndefined(config) ? memoryAdapter() : config;
  const scopeFn = config?.key;

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
    scope(env: Env | undefined): string {
      if (G.isUndefined(scopeFn) || G.isNullable(env)) return "";
      try {
        const prefix = scopeFn({ env: <E>(<unknown>env) });
        return G.isNullable(prefix) ? "" : prefix;
      } catch {
        return "";
      }
    },
  };
}
