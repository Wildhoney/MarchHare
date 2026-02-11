import {
  Brand,
  Filter,
  type CacheId,
  type ChanneledCacheId,
} from "../types/index.ts";

export type { CacheId, ChanneledCacheId };

/**
 * Creates a typed cache entry identifier for use with `context.actions.cacheable`
 * and `context.actions.invalidate`.
 *
 * Each call produces a unique identity. The first type parameter `T` binds the
 * entry to a specific value type, ensuring that `cacheable` callbacks return the
 * correct type.
 *
 * When called with only `T`, the entry is unchanneled &mdash; a single cache slot.
 * When called with `T` and `C`, the entry is channeled &mdash; independent cache
 * slots per channel value.
 *
 * @template T - The cached value type.
 * @template C - The channel type, constrained to `Filter`.
 * @returns A cache entry identifier for use with `cacheable` and `invalidate`.
 *
 * @example
 * ```ts
 * import { Entry } from "chizu";
 *
 * class CacheStore {
 *   // Unchanneled &mdash; single cache slot
 *   static Pairs = Entry<CryptoPair[]>();
 *
 *   // Channeled &mdash; independent slot per UserId
 *   static User = Entry<User, { UserId: number }>();
 * }
 *
 * // Unchanneled usage
 * await context.actions.cacheable(CacheStore.Pairs, 30_000, async () => ...);
 *
 * // Channeled usage
 * await context.actions.cacheable(CacheStore.User({ UserId: 5 }), 60_000, async () => ...);
 *
 * // Invalidate
 * context.actions.invalidate(CacheStore.Pairs);
 * context.actions.invalidate(CacheStore.User({ UserId: 5 }));
 * ```
 */
export function Entry<T>(): CacheId<T>;
export function Entry<T, C extends Filter>(): CacheId<T, C>;
export function Entry(): CacheId {
  const id = Symbol("chizu.cache/Entry");

  const entry = function (channel: Filter): ChanneledCacheId {
    return {
      [Brand.Cache]: id,
      channel,
    };
  };

  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(entry, Brand.Cache, {
    value: id,
    enumerable: false,
  });

  return <CacheId>(<unknown>entry);
}

/**
 * Extracts the identity symbol from a plain or channeled cache entry.
 */
export function getCacheSymbol(entry: CacheId | ChanneledCacheId): symbol {
  return <symbol>(<Record<symbol, unknown>>entry)[Brand.Cache];
}

/**
 * Type guard that returns `true` when the entry is a channeled cache identifier.
 */
export function isChanneledCacheId(
  entry: CacheId | ChanneledCacheId,
): entry is ChanneledCacheId {
  return "channel" in entry;
}

/**
 * Serialises a channel object into a deterministic string key.
 * Keys are sorted alphabetically for deterministic output.
 * Returns an empty string for unchanneled operations.
 */
export function serializeChannel(channel?: Filter): string {
  if (!channel) return "";
  return [...Object.keys(channel)]
    .toSorted()
    .map((key) => `${key}=${String(channel[key])}`)
    .join("&");
}

/**
 * Builds the cache Map key from an entry identifier.
 * Combines the symbol description (unique per Entry call) with the
 * serialised channel string for channeled entries.
 */
export function getCacheKey(entry: CacheId | ChanneledCacheId): string {
  const sym = getCacheSymbol(entry);
  const channelKey = isChanneledCacheId(entry)
    ? serializeChannel(<Filter>entry.channel)
    : "";
  return `${String(sym)}:${channelKey}`;
}

/**
 * Unwraps one layer of `Option` or `Result` from a value.
 *
 * - `Some(value)` (non-null/undefined) &rarr; `{ ok: true, value }`
 * - `None` (null/undefined) &rarr; `{ ok: false }`
 * - `Ok(value)` (TAG 0) &rarr; `{ ok: true, value: _0 }`
 * - `Error(value)` (TAG 1) &rarr; `{ ok: false }`
 */
export function unwrap(
  result: unknown,
): { ok: true; value: unknown } | { ok: false } {
  // Result (tagged union from ts-belt): { TAG: 0 | 1, _0: unknown }
  if (
    result !== null &&
    result !== undefined &&
    typeof result === "object" &&
    "TAG" in result
  ) {
    const tagged = <{ TAG: number; _0: unknown }>result;
    if (tagged.TAG === 0) return { ok: true, value: tagged._0 };
    return { ok: false };
  }

  // Option: null/undefined = None
  if (result === null || result === undefined) {
    return { ok: false };
  }

  // Some
  return { ok: true, value: result };
}
