import { Context } from "./utils.ts";
import type { Props, Rehydrator } from "./types.ts";
import * as React from "react";

export { useRehydrator } from "./utils.ts";
export type { Rehydrator } from "./types.ts";

/**
 * Creates a new rehydrate context for persisting model snapshots across
 * component unmount/remount cycles. Automatically included in `<Boundary>`.
 * Only needed directly if you want to isolate a rehydrate context.
 *
 * @param props.children - The children to render within the rehydrate context.
 * @returns The children wrapped in a rehydrate context provider.
 */
export function RehydrateProvider({ children }: Props): React.ReactNode {
  const rehydrator = React.useMemo<Rehydrator>(() => ({ data: new Map() }), []);

  return <Context.Provider value={rehydrator}>{children}</Context.Provider>;
}
