import * as React from "react";
import type { Props } from "./types.ts";
import { Context } from "./utils.ts";

export { useMode } from "./utils.ts";
export type { ModeHandle } from "./utils.ts";

/**
 * Provides a single mutable mode handle to every component inside the
 * boundary. Components opt in by calling {@link useMode} and threading the
 * returned handle through {@link useActions}'s `data` callback.
 *
 * Mode is **not** reactive &mdash; mutating it does not trigger a re-render.
 * Use it for cross-handler coordination (e.g. flagging an in-progress
 * sign-out) when you do not want the value showing up as render-time UI
 * state.
 */
export function Mode({ children }: Props): React.ReactNode {
  const ref = React.useRef<unknown>(null);
  return <Context.Provider value={ref}>{children}</Context.Provider>;
}
