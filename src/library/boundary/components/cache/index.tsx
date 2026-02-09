import { Context } from "./utils.ts";
import type { Props, CacheStore } from "./types.ts";
import * as React from "react";

export { useCache } from "./utils.ts";
export type { CacheEntry, CacheStore } from "./types.ts";

/**
 * Creates a new cache context for caching async results within action handlers.
 * Automatically included in `<Boundary>`. Only needed directly if you want to
 * isolate a cache context, useful for libraries that want their own cache
 * without interfering with the app's cache.
 *
 * @param props.children - The children to render within the cache context.
 * @returns The children wrapped in a cache context provider.
 */
export function CacheProvider({ children }: Props): React.ReactNode {
  const store = React.useMemo<CacheStore>(() => new Map(), []);

  return <Context.Provider value={store}>{children}</Context.Provider>;
}
