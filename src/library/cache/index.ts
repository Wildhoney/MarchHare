import {
  Brand,
  Filter,
  CachePayload,
  ChanneledCache,
  CachedValue,
  AnyCacheOperation,
  CacheFactory,
} from "../types/index.ts";
import { config } from "../utils/index.ts";

export {
  getCacheSymbol,
  getCacheTtl,
  isCacheOperation,
  isChanneledCache,
  isCached,
  serializeChannel,
  matchesCacheChannel,
} from "./utils.ts";

/**
 * Creates a new cache operation with a TTL (time-to-live) in milliseconds.
 *
 * Cache operations are identifiers used with `context.actions.cacheable()` and
 * `context.actions.invalidate()` to manage cached async results. They follow the
 * same channel pattern as actions.
 *
 * @template C - The channel type for keyed cache entries (defaults to never).
 * @param ttl - Time-to-live in milliseconds.
 * @returns A typed cache operation object.
 *
 * @example
 * ```ts
 * export class CacheStore {
 *   static User = Cache<{ UserId: number }>(30_000);  // 30s TTL, channeled
 *   static Config = Cache(60_000);                     // 60s TTL, unchanneled
 * }
 *
 * // Channeled usage
 * context.actions.cacheable(CacheStore.User({ UserId: 5 }), () => fetchUser(5));
 *
 * // Invalidation (partial channel match)
 * context.actions.invalidate(CacheStore.User({ UserId: 5 }));
 * context.actions.invalidate(CacheStore.User); // clears all
 * ```
 */
export const Cache = <CacheFactory>(<unknown>(<C extends Filter = never>(
  ttl: number,
): CachePayload<C> => {
  const symbol = Symbol(`${config.cachePrefix}${ttl}`);

  const operation = function (channel: C): ChanneledCache<C> {
    return {
      [Brand.Action]: symbol,
      [Brand.Cache]: true,
      [Brand.TTL]: ttl,
      [Brand.Channel]: channel,
      channel,
    };
  };

  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(operation, Brand.Action, {
    value: symbol,
    enumerable: false,
  });
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(operation, Brand.Cache, {
    value: true,
    enumerable: false,
  });
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(operation, Brand.TTL, {
    value: ttl,
    enumerable: false,
  });

  return <CachePayload<C>>operation;
}));

/**
 * Creates a cached model initialiser. When `useActions` processes
 * the initial model, it resolves cached values against the cache store and
 * substitutes them with the cached value or the fallback.
 *
 * @template T - The value type.
 * @param operation - The cache operation to look up.
 * @param fallback - The value to use if no cached entry exists.
 * @returns The cached value at runtime (or fallback), typed as T.
 *
 * @example
 * ```ts
 * const model: Model = {
 *   count: cache(CacheStore.Google, 1),
 * };
 * ```
 */
export function cache<T>(operation: AnyCacheOperation, fallback: T): T {
  return <T>(<unknown>(<CachedValue<T>>{
    [Brand.Cached]: true,
    operation,
    fallback,
  }));
}
