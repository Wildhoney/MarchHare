import * as React from "react";
import { G } from "@mobily/ts-belt";
import type { Props } from "./types.ts";
import { Context } from "./utils.ts";
import { useBroadcast } from "../broadcast/index.tsx";
import { StoreSymbol } from "../../../types/index.ts";

export { useStore } from "./utils.ts";

/**
 * Loose runtime shape for the per-`<Boundary>` Store. Each {@link App}
 * narrows this to its own typed store via `App<S>({ store })`; the
 * loose type exists so the framework's internal plumbing
 * (`<Boundary>`, `useStore`, handler `context.store`, Resource
 * fetcher `context.store`) does not need to be parametric over S.
 *
 * Consumers should declare their Store shape inline via `App({ store })`
 * &mdash; the inferred `S` is what flows through `app.useContext`,
 * `app.useStore`, and `app.Resource`. Module augmentation of `Store`
 * is no longer required.
 */
export type Store = Record<string, unknown>;

/**
 * Provides a per-Boundary {@link Store} value to every component inside
 * the boundary. Usually wired in via the `<Boundary store={initial}>`
 * prop rather than used directly.
 *
 * The Store is **not** reactive. Mutating it does not trigger a
 * re-render. Drive view state through the model; use the Store for
 * cross-handler coordination.
 */

export function Store({ initial, children }: Props): React.ReactNode {
  const ref = React.useRef<Store>(initial);
  const broadcast = useBroadcast();

  if (G.isUndefined(broadcast.getCached(StoreSymbol))) {
    broadcast.setCache(StoreSymbol, ref.current);
  }

  return <Context.Provider value={ref}>{children}</Context.Provider>;
}
