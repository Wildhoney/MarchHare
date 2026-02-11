import { Context } from "./utils.ts";
import type { Props, CacheContext } from "./types.ts";
import * as React from "react";

export { useCacheStore } from "./utils.ts";
export type { CacheContext } from "./types.ts";

/**
 * Creates a new cache context for storing values from `context.actions.cacheable`.
 * Automatically included in `<Boundary>`. Only needed directly if you want to
 * isolate a cache context.
 *
 * @param props.children - The children to render within the cache context.
 * @returns The children wrapped in a cache context provider.
 */
export function CacheProvider({ children }: Props): React.ReactNode {
  const cache = React.useMemo<CacheContext>(() => new Map(), []);

  return <Context.Provider value={cache}>{children}</Context.Provider>;
}
