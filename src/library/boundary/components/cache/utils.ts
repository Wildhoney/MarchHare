import type { CacheStore } from "./types.ts";
import * as React from "react";

/**
 * React context for the shared cache store.
 */
export const Context = React.createContext<CacheStore>(new Map());

/**
 * Hook to access the cache store from context.
 *
 * @returns The cache store Map from the current context.
 */
export function useCache(): CacheStore {
  return React.useContext(Context);
}
