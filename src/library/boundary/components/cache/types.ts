import type { Filter } from "../../../types/index.ts";
import type * as React from "react";

/**
 * A single cache entry with its stored value, expiration timestamp, and
 * original channel for partial-match invalidation.
 */
export type CacheEntry = {
  value: unknown;
  expiresAt: number;
  channel: Filter | undefined;
};

/**
 * The cache store: outer Map keyed by operation symbol, inner Map keyed
 * by serialised channel string.
 *
 * For unchanneled cache operations, the inner key is an empty string "".
 */
export type CacheStore = Map<symbol, Map<string, CacheEntry>>;
/**
 * Props for the CacheProvider component.
 */
export type Props = {
  children: React.ReactNode;
};
