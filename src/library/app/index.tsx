import * as React from "react";
import { Boundary as BaseBoundary } from "../boundary/index.tsx";
import { useContext as baseUseContext } from "../context/index.ts";
import { useStore as baseUseStore } from "../boundary/components/store/utils.ts";
import type { Store } from "../boundary/components/store/index.tsx";
import { Resource as BaseResource } from "../resource/index.ts";
import type { Fetcher, ResourceHandle } from "../resource/types.ts";
import type { Cache } from "../cache/index.ts";
import type { Actions, Model, Props } from "../types/index.ts";
import { createScope, type Scope } from "../scope/index.tsx";
import type { AppContextHandle, AppFetcher, AppResource } from "./types.ts";

export type {
  AppArgs,
  AppContextHandle,
  AppFetcher,
  AppResource,
} from "./types.ts";

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
  /**
   * Opens a typed multicast scope. The generic `MulticastActions` declares
   * the `Distribution.Multicast` action class (or union of classes)
   * whose dispatches are routed through this scope &mdash; the
   * returned handle mirrors the App surface but widens
   * `useContext().actions.dispatch` to accept actions from `MulticastActions`
   * on top of the local `AC` class.
   *
   * Render `<scope.Boundary>` to open the scope at runtime; nesting
   * multiple boundaries from different `app.Scope()` calls is fine,
   * each runs as an independent emitter shadowed for its subtree.
   *
   * The Scope handle deliberately does NOT expose a further `Scope`
   * method &mdash; the multicast surface must be declared at the
   * `app.Scope<MulticastActions>()` call site so the type union is explicit.
   */
  readonly Scope: <MulticastActions>() => Scope<S, MulticastActions>;
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
    Scope<MulticastActions>() {
      return createScope<S, MulticastActions>();
    },
  };
}
