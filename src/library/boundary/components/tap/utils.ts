import * as React from "react";
import type { Tap } from "./types.ts";

const noop: Tap = () => {};

/**
 * React context carrying the active {@link Tap} observer for the
 * surrounding `<Boundary>`. Defaults to a no-op so `useTap()` callers
 * never need to null-check.
 */
export const Context = React.createContext<Tap>(noop);

/**
 * Hook returning the active tap observer. Always returns a callable
 * &mdash; if no `<Boundary tap={...}>` is mounted above, calls are
 * silent no-ops with no allocation cost beyond the function call itself.
 */
export function useTap(): Tap {
  return React.useContext(Context);
}
