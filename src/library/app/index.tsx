import * as React from "react";
import { Boundary as BaseBoundary } from "../boundary/index.tsx";
import { useContext as baseUseContext } from "../hooks/index.ts";
import { useStore as baseUseStore } from "../boundary/components/store/utils.ts";
import type { Store } from "../boundary/components/store/index.tsx";
import {
  Resource as BaseResource,
  type Resource as ResourceHandle,
} from "../resource/index.ts";
import type { Args, Fetcher } from "../resource/types.ts";
import type { Cache } from "../cache/index.ts";
import type {
  Actions,
  Context,
  Model,
  Props,
  UseActions,
} from "../types/index.ts";
import type { Data } from "../hooks/types.ts";

/**
 * Args object passed to an `app.Resource` fetcher. Same shape as the
 * base `Resource` fetcher's args but with `store` typed as `S`.
 */
export type AppArgs<S, P extends object = Record<never, never>> = Omit<
  Args<P>,
  "store"
> & {
  readonly store: Readonly<S>;
};

/**
 * Fetcher signature for an `app.Resource` declaration. The fetcher's
 * `context.store` is typed against the App's inferred Store shape `S`.
 */
export type AppFetcher<S, T, P extends object = Record<never, never>> = (
  context: AppArgs<S, P>,
) => Promise<T>;

/**
 * `app.Resource(fetcher)` &mdash; in-memory cache, no persistence.
 * `app.Resource.Cachable(cache, fetcher)` &mdash; persistent cache wired
 * to the supplied `Cache` adapter. Both forms type `context.store` as
 * the App's Store shape.
 */
export type AppResource<S> = {
  <T, P extends object = Record<never, never>>(
    fetcher: AppFetcher<S, T, P>,
  ): ResourceHandle<T, P>;
  readonly Cachable: <T, P extends object = Record<never, never>>(
    cache: Cache,
    fetcher: AppFetcher<S, T, P>,
  ) => ResourceHandle<T, P>;
};

// Phantom marker so consumers of the App's hooks see `store: S` typing
// at the type-system level; at runtime the value is the same proxy as
// the loose `Store` type.
type StoreView<S> = { readonly __appStore?: S };

type AppActionsResult<M, AC, D, S> = UseActions<
  M extends Model | void ? M : void,
  AC extends Actions | void ? AC : void,
  D extends Props ? D : Props
> &
  StoreView<S>;

type AppUseActions<M, AC, D, S> = M extends void
  ? (getData?: Data<D & Props>) => AppActionsResult<M, AC, D, S>
  : (
      initialModel: M,
      getData?: Data<D & Props>,
    ) => AppActionsResult<M, AC, D, S>;

/**
 * `Context` handle returned by `app.useContext()`. Mirrors the base
 * {@link Context} but with the Store-typed slots overridden to `S`.
 */
export type AppContextHandle<M, AC, D, S> = {
  readonly actions: {
    dispatch: Context<
      M extends Model | void ? M : void,
      AC extends Actions | void ? AC : void,
      D extends Props ? D : Props
    >["actions"]["dispatch"];
  };
  readonly useActions: AppUseActions<M, AC, D, S>;
};

/**
 * Returned from {@link App}. Bundles the Boundary, hooks, and Resource
 * factory bound to a single typed Store shape `S`.
 */
export type App<S extends object> = {
  /**
   * Boundary component for this App. Wraps the subtree with the initial
   * `store` value passed to {@link App}.
   */
  readonly Boundary: React.FC<{ children: React.ReactNode }>;
  /**
   * Hook returning a stable `Context` handle. The handle's
   * `context.useActions(initialModel?, getData?)` materialises the
   * component's `[model, actions, data]` tuple. Every handler's
   * `context.store` is typed as `S`.
   */
  readonly useContext: <
    M extends Model | void = void,
    AC extends Actions | void = void,
    D extends Props = Props,
  >() => AppContextHandle<M, AC, D, S>;
  /**
   * Read-only Proxy over the per-Boundary Store, typed as `S`. Reads use
   * dot notation (`store.session`) and always reflect the latest value
   * across `await` boundaries. Writes flow through
   * `context.actions.produce(({ store }) => { ... })`.
   */
  readonly useStore: () => Readonly<S>;
  /**
   * `Resource` factory bound to this App's Store. Same shape as the
   * top-level `Resource`: call directly for an in-memory cache, or use
   * `app.Resource.Cachable(cache, fetcher)` for persistence.
   */
  readonly Resource: AppResource<S>;
};

/**
 * Creates an `App` &mdash; the entrypoint for a typed Store shape `S`,
 * inferred from `config.store`. `App<S>` exposes `Boundary`, hooks, and
 * a `Resource` factory all wired against the same shape.
 *
 * Each `<app.Boundary>` instance owns its own Store, so different `App`s
 * can coexist in the same tree with completely independent shapes.
 *
 * @example
 * ```tsx
 * import { App } from "march-hare";
 *
 * type Session = { accessToken: string };
 *
 * export const app = App({
 *   store: {
 *     session: null as Session | null,
 *     operating: "idle" as "idle" | "signing-out",
 *   },
 * });
 *
 * // Root render.
 * <app.Boundary>
 *   <Root />
 * </app.Boundary>;
 *
 * // In a feature's actions.ts:
 * export function useAuthActions() {
 *   const context = app.useContext<void, typeof Actions>();
 *   const actions = context.useActions();
 *
 *   actions.useAction(Actions.SignOut, async (context) => {
 *     context.actions.produce(({ store }) => {
 *       store.session = null;
 *     });
 *   });
 *
 *   return actions;
 * }
 *
 * // In resources.ts:
 * export const user = app.Resource<User>((context) =>
 *   ky
 *     .get("/api/user", {
 *       headers: context.store.session
 *         ? { Authorization: `Bearer ${context.store.session.accessToken}` }
 *         : {},
 *       signal: context.controller.signal,
 *     })
 *     .json<User>(),
 * );
 * ```
 */
export function App<S extends object = Store>(config?: { store: S }): App<S> {
  function Boundary({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement {
    return (
      <BaseBoundary store={config?.store as unknown as never}>
        {children}
      </BaseBoundary>
    );
  }

  function useTypedContext<
    M extends Model | void = void,
    AC extends Actions | void = void,
    D extends Props = Props,
  >(): AppContextHandle<M, AC, D, S> {
    return baseUseContext() as unknown as AppContextHandle<M, AC, D, S>;
  }

  function useTypedStore(): Readonly<S> {
    return baseUseStore() as unknown as Readonly<S>;
  }

  const Resource = Object.assign(
    function TypedResource<T, P extends object = Record<never, never>>(
      fetcher: AppFetcher<S, T, P>,
    ): ResourceHandle<T, P> {
      return BaseResource<T, P>(fetcher as Fetcher<T, P>);
    },
    {
      Cachable<T, P extends object = Record<never, never>>(
        cache: Cache,
        fetcher: AppFetcher<S, T, P>,
      ): ResourceHandle<T, P> {
        return BaseResource.Cachable<T, P>(cache, fetcher as Fetcher<T, P>);
      },
    },
  ) as AppResource<S>;

  return {
    Boundary,
    useContext: useTypedContext,
    useStore: useTypedStore,
    Resource,
  };
}
