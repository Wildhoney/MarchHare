import * as React from "react";
import { G } from "@mobily/ts-belt";
import type { Props } from "./types.ts";
import { Context } from "./utils.ts";
import { useBroadcast } from "../broadcast/index.tsx";
import { EnvSymbol } from "../../../types/index.ts";

export { useEnv } from "./utils.ts";

/**
 * Loose runtime shape for the per-`<Boundary>` Env. Each {@link App}
 * narrows this to its own typed env via `App<S>({ env })`; the
 * loose type exists so the framework's internal plumbing
 * (`<Boundary>`, `useEnv`, handler `context.env`, Resource
 * fetcher `context.env`) does not need to be parametric over S.
 *
 * Consumers should declare their Env shape inline via `App({ env })`
 * &mdash; the inferred `S` is what flows through `app.useContext`,
 * `app.useEnv`, and `app.Resource`. Module augmentation of `Env`
 * is no longer required.
 */
export type Env = Record<string, unknown>;

/**
 * Provides a per-Boundary {@link Env} value to every component inside
 * the boundary. Usually wired in via the `<Boundary env={initial}>`
 * prop rather than used directly.
 *
 * The Env is **not** reactive. Mutating it does not trigger a
 * re-render. Drive view state through the model; use the Env for
 * cross-handler coordination.
 */

export function Env({ initial, children }: Props): React.ReactNode {
  const ref = React.useRef<Env>(initial);
  const broadcast = useBroadcast();

  if (G.isUndefined(broadcast.getCached(EnvSymbol))) {
    broadcast.setCache(EnvSymbol, ref.current);
  }

  return <Context.Provider value={ref}>{children}</Context.Provider>;
}
