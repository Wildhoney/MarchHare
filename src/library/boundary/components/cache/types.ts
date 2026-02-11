import type * as React from "react";

/**
 * A single cached value with its expiry timestamp.
 */
export type CacheItem = {
  value: unknown;
  expiry: number;
};

/**
 * Store for cached values.
 * Keyed by a deterministic string derived from the entry symbol and channel.
 */
export type CacheContext = Map<string, CacheItem>;

/**
 * Props for the CacheProvider component.
 */
export type Props = {
  children: React.ReactNode;
};
