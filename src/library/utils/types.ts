import { unset } from "./utils.ts";

/** Nominal type of the {@link unset} sentinel. */
export type Unset = typeof unset;

/**
 * Common shape for a possibly-present value with a timestamp. Produced by
 * `Bundle.snapshot()` (from the in-memory cache) and by `Cache.get(key)`
 * (from persistent storage). Both feed into the bundle's overloaded
 * `.otherwise(...)`, which seeds the cache when given a Stored that
 * carries data and a timestamp.
 *
 * @template T The payload type when present.
 */
export type Stored<T> = {
  /** The payload, or {@link unset} when nothing is recorded. */
  readonly data: T | Unset;
  /** When the payload was recorded, or `null` when nothing is recorded. */
  readonly at: Temporal.Instant | null;
  /**
   * Returns {@link data} when present, otherwise the supplied fallback.
   * Symmetric with `Bundle.otherwise(...)`'s terminal form.
   */
  readonly else: <U>(fallback: U) => T | U;
};
