import * as React from "react";
import { BroadcastEmitter } from "../boundary/components/broadcast/utils.ts";
import { Context as ScopeReactContext } from "../boundary/components/scope/utils.ts";
import type { ScopeEntry } from "../boundary/components/scope/types.ts";
import { useContext as baseUseContext } from "../context/index.ts";
import { useEnv as baseUseEnv } from "../boundary/components/env/utils.ts";
import { Resource as BaseResource } from "../resource/index.ts";
import type { Fetcher, ResourceHandle } from "../resource/types.ts";
import type { Cache } from "../cache/index.ts";
import type {
  AppContextHandle,
  AppFetcher,
  AppResource,
} from "../app/types.ts";
import type { Actions, Model, Props } from "../types/index.ts";

/**
 * Handle returned by `app.Scope<MulticastActions>()`. Mirrors the {@link App}
 * surface (`Boundary`, `useContext`, `useEnv`, `Resource`) but typed
 * against a specific multicast action surface `MulticastActions` and the
 * enclosing App's Env shape `S`.
 *
 * Notably absent: a nested `Scope` method. Nesting scopes is supported
 * at the React-tree level &mdash; just render two `<scope.Boundary>`s
 * &mdash; but each scope must come from a distinct
 * `app.Scope<MulticastActions>()` call so that its multicast surface is
 * declared up-front.
 *
 * @template S The enclosing App's Env shape.
 * @template MulticastActions The multicast Actions class (or union of
 *  classes) this scope's `useContext().actions.dispatch` is allowed
 *  to fire.
 */
export type Scope<S extends object, MulticastActions> = {
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
   * surface `MulticastActions` in addition to the local `AC` &mdash; mirroring
   * the way `Actions.Broadcast = BroadcastActions` already widens the
   * dispatch surface for broadcasts.
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
    S
  >;
  /**
   * Read-only Proxy over the enclosing App's Env. Identical to
   * `app.useEnv` &mdash; the Scope does not introduce its own Env;
   * scopes are about multicast routing, not ambient state.
   */
  readonly useEnv: () => Readonly<S>;
  /**
   * Resource factory bound to the enclosing App's Env. Identical to
   * `app.Resource`; provided on the scope handle for convenience so a
   * scoped feature can keep all its primitives in one place.
   */
  readonly Resource: AppResource<S>;
};

/**
 * Internal constructor for a {@link Scope} handle. Called from inside
 * `App<S>()` so the enclosing Env shape `S` is captured at the type
 * level.
 *
 * @internal
 */
export function createScope<S extends object, MulticastActions>(): Scope<
  S,
  MulticastActions
> {
  function Boundary({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement {
    const entry = React.useMemo<ScopeEntry>(
      () => ({
        id: Symbol("march-hare.scope/instance"),
        emitter: new BroadcastEmitter(),
      }),
      [],
    );
    return (
      <ScopeReactContext.Provider value={entry}>
        {children}
      </ScopeReactContext.Provider>
    );
  }

  function useTypedContext<
    LocalModel extends Model | void = void,
    AC extends Actions | void = void,
    D extends Props = Props,
  >(): AppContextHandle<
    LocalModel,
    MulticastActions extends Actions
      ? AC extends Actions
        ? AC & MulticastActions
        : MulticastActions
      : AC,
    D,
    S
  > {
    return baseUseContext() as unknown as AppContextHandle<
      LocalModel,
      MulticastActions extends Actions
        ? AC extends Actions
          ? AC & MulticastActions
          : MulticastActions
        : AC,
      D,
      S
    >;
  }

  function useTypedEnv(): Readonly<S> {
    return baseUseEnv() as unknown as Readonly<S>;
  }

  const Resource = Object.assign(
    function TypedResource<T, P extends object = Record<never, never>>(
      fetcher: AppFetcher<S, T, P>,
    ): ResourceHandle<T, P> {
      return BaseResource<T, P>(fetcher as unknown as Fetcher<T, P>);
    },
    {
      Cachable<T, P extends object = Record<never, never>>(
        cache: Cache,
        fetcher: AppFetcher<S, T, P>,
      ): ResourceHandle<T, P> {
        return BaseResource.Cachable<T, P>(
          cache,
          fetcher as unknown as Fetcher<T, P>,
        );
      },
    },
  ) as AppResource<S>;

  return {
    Boundary,
    useContext: useTypedContext,
    useEnv: useTypedEnv,
    Resource,
  };
}
