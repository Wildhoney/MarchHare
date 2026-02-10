import {
  Brand,
  Filter,
  CachePayload,
  ChanneledCache,
  CacheFactory,
} from "../types/index.ts";
import { config } from "../utils/index.ts";

export {
  getCacheSymbol,
  getCacheTtl,
  isCacheOperation,
  isChanneledCache,
  serializeChannel,
  matchesCacheChannel,
} from "./utils.ts";

/**
 * Creates a new cache operation with a TTL (time-to-live) in milliseconds.
 *
 * Cache operations are identifiers used with `context.actions.cache.put()` and
 * `context.actions.cache.delete()` to manage cached async results. They follow the
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
 * context.actions.cache.put(CacheStore.User({ UserId: 5 }), () => fetchUser(5));
 *
 * // Deletion (partial channel match)
 * context.actions.cache.delete(CacheStore.User({ UserId: 5 }));
 * context.actions.cache.delete(CacheStore.User); // clears all
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
