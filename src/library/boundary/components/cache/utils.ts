import type { CacheContext } from "./types.ts";
import * as React from "react";

/**
 * React context for the shared cache store.
 */
export const Context = React.createContext<CacheContext>(new Map());

/**
 * Hook to access the cache store from context.
 *
 * @returns The cache Map from the nearest CacheProvider.
 */
export function useCacheStore(): CacheContext {
  return React.useContext(Context);
}
