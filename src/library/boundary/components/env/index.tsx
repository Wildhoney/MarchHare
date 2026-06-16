import * as React from "react";
import { G } from "@mobily/ts-belt";
import type { Env as EnvType, Props } from "./types.ts";
import { Context } from "./utils.ts";
import { useBroadcast } from "../broadcast/index.tsx";
import { EnvSymbol } from "../../../types/index.ts";

export { useEnv } from "./utils.ts";

/**
 * Provides a per-Boundary {@link EnvType} value to every component inside
 * the boundary. Usually wired in via the `<Boundary env={initial}>`
 * prop rather than used directly.
 *
 * The Env is **not** reactive. Mutating it does not trigger a
 * re-render. Drive view state through the model; use the Env for
 * cross-handler coordination.
 */

export function Env({ initial, children }: Props): React.ReactNode {
  const ref = React.useRef<EnvType>(initial);
  const broadcast = useBroadcast();

  if (G.isUndefined(broadcast.getCached(EnvSymbol))) {
    broadcast.setCache(EnvSymbol, ref.current);
  }

  return <Context.Provider value={ref}>{children}</Context.Provider>;
}
