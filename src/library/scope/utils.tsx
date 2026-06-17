import * as React from "react";
import { BroadcastEmitter } from "../boundary/components/broadcast/utils.ts";
import { Context as ScopeReactContext } from "../boundary/components/scope/utils.ts";
import type { ScopeEntry } from "../boundary/components/scope/types.ts";
import { useContext as baseUseContext } from "../context/index.ts";
import { useEnv as baseUseEnv } from "../boundary/components/env/utils.ts";
import { Resource as BaseResource } from "../resource/index.ts";
import type { ResourceHandle } from "../resource/types.ts";
import type { Cache } from "../cache/index.ts";
import type { Env } from "../boundary/components/env/types.ts";
import type { AppContextHandle, AppFetcher } from "../app/types.ts";
import type { Actions, Model, Props } from "../types/index.ts";
import type { ScopeHandle } from "./types.ts";

/**
 * Internal constructor for a {@link ScopeHandle}. Called from inside
 * `App<E>()` so the enclosing Env shape `E` is captured at the type
 * level. The optional `cache` is the same value `App({ cache })` was
 * constructed with &mdash; resources declared via `scope.Resource`
 * share that cache. `getEnv` resolves the live Env from the enclosing
 * `app.Boundary` so cache-key scoping works for sync `.get()` reads.
 *
 * @internal
 */
export function createScope<E extends object, MulticastActions>(
  cache?: Cache,
  getEnv?: () => Env | undefined,
): ScopeHandle<E, MulticastActions> {
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
    E
  > {
    return baseUseContext() as unknown as AppContextHandle<
      LocalModel,
      MulticastActions extends Actions
        ? AC extends Actions
          ? AC & MulticastActions
          : MulticastActions
        : AC,
      D,
      E
    >;
  }

  function useTypedEnv(): Readonly<E> {
    return baseUseEnv() as unknown as Readonly<E>;
  }

  function Resource<T, P extends object = Record<never, never>>(
    fetcher: AppFetcher<E, T, P>,
  ): ResourceHandle<T, P> {
    return BaseResource<E, T, P>(fetcher, cache, getEnv);
  }

  return {
    Boundary,
    useContext: useTypedContext,
    useEnv: useTypedEnv,
    Resource,
  };
}
