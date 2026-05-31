import * as React from "react";
import type { PendingCall } from "../../../resource/index.ts";

/**
 * Per-`<Boundary>` registry for `.coalesce(token)` sharing. Outer map
 * keys on the `PendingCall.run` function identity (stable per Resource
 * via the `build()` closure); inner map keys on
 * `${paramsKey}|${coalesceKey(token)}`. While an entry exists every
 * caller awaiting `.coalesce(token)` for the same Resource + params +
 * token receives the same promise.
 *
 * Lifted into React context so each `<app.Boundary>` owns its own
 * registry &mdash; two `App` instances in the same tree cannot collide
 * on a shared token like `.coalesce("k")`.
 *
 * @internal
 */
export type Sharing = WeakMap<
  PendingCall["run"],
  Map<string, Promise<unknown>>
>;

const fallback: Sharing = new WeakMap();

/**
 * React context exposing the per-Boundary sharing registry. The
 * fallback is a fresh `WeakMap` used when `useSharing()` is read
 * outside any `<Boundary>` &mdash; calls work but never share with any
 * other component.
 *
 * @internal
 */
export const Context = React.createContext<Sharing>(fallback);

/**
 * Wraps children with a Boundary-scoped sharing registry for
 * `.coalesce(token)`. Rendered as part of {@link Boundary}; not
 * exposed standalone.
 *
 * @internal
 */
export function SharingProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const registry = React.useMemo<Sharing>(() => new WeakMap(), []);
  return <Context.Provider value={registry}>{children}</Context.Provider>;
}

/**
 * Hook returning the per-Boundary sharing registry. Used by the
 * `.coalesce(token)` chainable inside `useActions`.
 *
 * @internal
 */
export function useSharing(): Sharing {
  return React.useContext(Context);
}
