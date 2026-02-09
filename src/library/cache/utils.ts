import { Brand, Filter } from "../types/index.ts";
import { G } from "@mobily/ts-belt";

/**
 * Extracts the underlying symbol from a cache operation or channeled cache.
 *
 * @param operation The cache operation to extract the symbol from.
 * @returns The underlying symbol.
 */
export function getCacheSymbol(operation: unknown): symbol {
  if (
    (G.isObject(operation) || G.isFunction(operation)) &&
    Brand.Action in operation
  ) {
    return (<{ [Brand.Action]: symbol }>operation)[Brand.Action];
  }
  throw new Error("Invalid cache operation");
}

/**
 * Extracts the TTL from a cache operation or channeled cache.
 *
 * @param operation The cache operation to extract the TTL from.
 * @returns The TTL in milliseconds.
 */
export function getCacheTtl(operation: unknown): number {
  if (
    (G.isObject(operation) || G.isFunction(operation)) &&
    Brand.TTL in operation
  ) {
    return (<{ [Brand.TTL]: number }>operation)[Brand.TTL];
  }
  throw new Error("Invalid cache operation");
}

/**
 * Checks whether a value is a cache operation.
 *
 * @param value The value to check.
 * @returns True if the value is a cache operation.
 */
export function isCacheOperation(value: unknown): boolean {
  return (
    (G.isObject(value) || G.isFunction(value)) &&
    Brand.Cache in value &&
    (<{ [Brand.Cache]: boolean }>value)[Brand.Cache] === true
  );
}

/**
 * Checks whether a value is a channeled cache operation.
 *
 * @param value The value to check.
 * @returns True if the value is a channeled cache operation with a channel property.
 */
export function isChanneledCache(value: unknown): boolean {
  return (
    isCacheOperation(value) &&
    G.isObject(value) &&
    Brand.Channel in value &&
    "channel" in value
  );
}

/**
 * Checks whether a value is a cached model initialiser created by the `cache()` function.
 *
 * @param value The value to check.
 * @returns True if the value is a cached model initialiser.
 */
export function isCached(value: unknown): boolean {
  return (
    G.isObject(value) &&
    Brand.Cached in value &&
    (<{ [Brand.Cached]: boolean }>value)[Brand.Cached] === true
  );
}

/**
 * Serialises a channel object into a deterministic string key for cache lookup.
 * Keys are sorted alphabetically for deterministic output.
 * Returns an empty string for unchanneled operations.
 *
 * @param channel The channel object to serialise.
 * @returns A deterministic string representation of the channel.
 */
export function serializeChannel(channel?: Filter): string {
  if (!channel) return "";
  return [...Object.keys(channel)]
    .toSorted()
    .map((key) => `${key}=${String(channel[key])}`)
    .join("&");
}

/**
 * Checks whether an invalidation channel partially matches a stored channel.
 * Returns true if ALL keys in the invalidation channel exist in the stored
 * channel with matching values.
 *
 * @param invalidateChannel The channel from the invalidation call.
 * @param storedChannel The channel stored with the cache entry.
 * @returns True if the invalidation channel is a subset of the stored channel.
 */
export function matchesCacheChannel(
  invalidateChannel: Filter,
  storedChannel: Filter,
): boolean {
  return Object.keys(invalidateChannel).every(
    (key) => storedChannel[key] === invalidateChannel[key],
  );
}
