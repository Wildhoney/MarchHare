import * as React from "react";
import type { Invocation } from "../../../resource/index.ts";

/**
 * Per-caller record stored in the {@link Sharing} registry. The
 * `promise` is the shared in-flight fetch, `controller` is the
 * detached `AbortController` driving it, and `refs` tracks how many
 * callers are currently waiting. When the last caller releases (its
 * `context.task.controller` aborts), the entry aborts its controller
 * so the underlying work is cancelled rather than orphaned.
 *
 * @internal
 */
export type Share<T = unknown> = {
  promise: Promise<T>;
  controller: AbortController;
  refs: number;
};

/**
 * Per-`<Boundary>` registry for the default coalesce path. Outer map
 * keys on the `Invocation.run` function identity (stable per Resource
 * via the `build()` closure); inner map keys on
 * `JSON.stringify(params)`. While an entry exists every caller for the
 * same Resource + params joins the same {@link Share} record and
 * resolves against its promise.
 *
 * Lifted into React context so each `<app.Boundary>` owns its own
 * registry &mdash; two `App` instances in the same tree cannot collide
 * on the same `(Resource, params)` pair.
 *
 * @internal
 */
export type Sharing = WeakMap<
  Invocation<unknown, object>["run"],
  Map<string, Share>
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
 * Wraps children with a Boundary-scoped sharing registry for the
 * default coalesce path. Rendered as part of {@link Boundary}; not
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
 * default coalesce path inside `useActions`.
 *
 * @internal
 */
export function useSharing(): Sharing {
  return React.useContext(Context);
}
