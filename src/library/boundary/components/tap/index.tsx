import * as React from "react";
import { Context } from "./utils.ts";
import type { Props, Tap } from "./types.ts";

export { useTap } from "./utils.ts";
export type {
  Tap,
  Tapped,
  Invocation,
  Failure,
  Mutations,
  Snapshot,
} from "./types.ts";

/**
 * Internal provider that wires a {@link Tap} observer into the React
 * context consumed by `useActions` during dispatch. Rendered by the
 * top-level `<Boundary>` (and indirectly by `<app.Boundary>`); not
 * exposed on the public surface &mdash; consumers should pass the
 * callback via the `tap` prop of either boundary instead of mounting
 * this provider directly.
 *
 * The supplied `tap` callback is held in a `useRef` and indirected
 * through a stable `useMemo` wrapper. The ref is synchronised inside a
 * `useLayoutEffect` &mdash; React's sanctioned write-after-commit
 * window &mdash; so the provider stays compatible with Concurrent
 * rendering, where the render function may be invoked more than once
 * per commit and direct mutation during render would race the
 * scheduler.
 *
 * Keeping the context value referentially constant for the lifetime of
 * the boundary means callers may pass inline arrow functions without
 * invalidating the dispatch pipeline on every render &mdash; the
 * latest callback is read at fire time, not at provider-render time.
 * When `tap` is `undefined`, the wrapper short-circuits via optional
 * chaining: no allocation per event beyond the wrapper call itself.
 *
 * @param props.tap Observer to receive lifecycle events for every action
 *   handler dispatched inside the boundary. See {@link Tap}.
 * @param props.children Subtree that should observe the supplied tap.
 * @returns Children rendered inside the tap context provider.
 *
 * @see {@link Tap} &mdash; the observer signature.
 * @see {@link Tapped} &mdash; the discriminated union of event shapes.
 */
export function Tappable({ tap, children }: Props): React.ReactNode {
  const ref = React.useRef<Tap | undefined>(tap);
  React.useLayoutEffect(() => void (ref.current = tap), [tap]);

  const value = React.useMemo<Tap>(() => (event) => ref.current?.(event), []);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
