import type * as React from "react";
import type { AppContextHandle, AppResource } from "../app/types.ts";
import type { Actions, Model, Props } from "../types/index.ts";

/**
 * Handle returned by `app.Scope<MulticastActions>()`. Mirrors the
 * `App` surface (`Boundary`, `useContext`, `useEnv`, `Resource`) but
 * typed against a specific multicast action surface `MulticastActions`
 * and the enclosing App's Env shape `E`.
 *
 * Notably absent: a nested `Scope` method. Nesting scopes is supported
 * at the React-tree level &mdash; just render two `<scope.Boundary>`s
 * &mdash; but each scope must come from a distinct
 * `app.Scope<MulticastActions>()` call so that its multicast surface is
 * declared up-front.
 *
 * @template E The enclosing App's Env shape.
 * @template MulticastActions The multicast Actions class (or union of
 *  classes) this scope's `useContext().actions.dispatch` is allowed
 *  to fire.
 */
export type Scope<E extends object, MulticastActions> = {
  /**
   * Boundary component. Wrap a subtree to open a fresh multicast scope
   * &mdash; every `Distribution.Multicast` action dispatched inside this
   * subtree routes through this boundary's emitter, and every handler
   * subscribed via `scope.useContext().useActions(...)` on that subtree
   * receives the event.
   *
   * Each render of `<scope.Boundary>` opens a distinct scope instance;
   * unmounting tears the emitter down.
   */
  readonly Boundary: React.FC<{ children: React.ReactNode }>;
  /**
   * Hook returning a stable `Context` handle. Identical to
   * `app.useContext` except `actions.dispatch` accepts the multicast
   * surface `MulticastActions` in addition to the local `AC` &mdash;
   * mirroring the way `Actions.Broadcast = BroadcastActions` already
   * widens the dispatch surface for broadcasts.
   */
  readonly useContext: <
    LocalModel extends Model | void = void,
    AC extends Actions | void = void,
    D extends Props = Props,
  >() => AppContextHandle<
    LocalModel,
    MulticastActions extends Actions
      ? AC extends Actions
        ? AC & MulticastActions
        : MulticastActions
      : AC,
    D,
    E
  >;
  /**
   * Read-only Proxy over the enclosing App's Env. Identical to
   * `app.useEnv` &mdash; the Scope does not introduce its own Env;
   * scopes are about multicast routing, not ambient state.
   */
  readonly useEnv: () => Readonly<E>;
  /**
   * Resource factory bound to the enclosing App's Env. Identical to
   * `app.Resource`; provided on the scope handle for convenience so a
   * scoped feature can keep all its primitives in one place.
   */
  readonly Resource: AppResource<E>;
};
