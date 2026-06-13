import * as React from "react";
import { Boundary as BaseBoundary } from "../boundary/index.tsx";
import { useContext as baseUseContext } from "../context/index.ts";
import { useEnv as baseUseEnv } from "../boundary/components/env/utils.ts";
import type { Env } from "../boundary/components/env/index.tsx";
import { Resource as BaseResource } from "../resource/index.ts";
import type { ResourceHandle } from "../resource/types.ts";
import type { Cache } from "../cache/index.ts";
import type { Actions, Model, Props } from "../types/index.ts";
import { createScope, type Scope } from "../scope/index.tsx";
import type { AppContextHandle, AppFetcher, AppResource } from "./types.ts";
import type { Tap } from "../boundary/components/tap/types.ts";

export type {
  AppArgs,
  AppContextHandle,
  AppFetcher,
  AppResource,
} from "./types.ts";

/**
 * Returned from {@link App}. Bundles the Boundary, hooks, and Resource
 * factory bound to a single typed Env shape `S`.
 */
export type App<S extends object> = {
  /**
   * Boundary component for this App. Wraps the subtree with the `env`
   * and `tap` declared on {@link App} &mdash; both are fixed at App
   * construction time and cannot be overridden at the render site.
   * Runtime mutations to the Env flow through
   * `context.actions.produce(({ env }) => { ... })`; if a test or
   * storybook needs a different initial Env, declare a separate `App`.
   */
  readonly Boundary: React.FC<{
    children: React.ReactNode;
  }>;
  /**
   * Hook returning a stable `Context` handle. The handle's
   * `context.useActions(model?, getData?)` materialises the
   * component's `[model, actions, data]` tuple. Every handler's
   * `context.env` is typed as `S`.
   */
  readonly useContext: <
    M extends Model | void = void,
    AC extends Actions | void = void,
    D extends Props = Props,
  >() => AppContextHandle<M, AC, D, S>;
  /**
   * Read-only Proxy over the per-Boundary Env, typed as `S`. Reads use
   * dot notation (`env.session`) and always reflect the latest value
   * across `await` boundaries. Writes flow through
   * `context.actions.produce(({ env }) => { ... })`.
   */
  readonly useEnv: () => Readonly<S>;
  /**
   * `Resource` factory bound to this App's Env. Resources declared
   * through this factory share the cache passed to `App({ cache })`
   * &mdash; or fall back to a per-resource in-memory slot when no
   * cache is configured on the App.
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
 * Creates an `App` &mdash; the entrypoint for a typed Env shape `S`,
 * inferred from `config.env`. `App<S>` exposes `Boundary`, hooks, and
 * a `Resource` factory all wired against the same shape.
 *
 * Each `<app.Boundary>` instance owns its own Env, so different `App`s
 * can coexist in the same tree with completely independent shapes.
 *
 * Pass `tap` to subscribe to every action handler's dispatch / settle /
 * error inside the boundary &mdash; useful for analytics, audit logging,
 * Sentry breadcrumbs. See `recipes/tap.md`. Pass `cache` to persist
 * every `app.Resource(fetcher)` declaration through a single
 * {@link Cache} &mdash; each resource is namespaced inside the cache by
 * its declaration order, so reloads seed from storage automatically and
 * resources do not collide on shared params keys. Omit `cache` to keep
 * each resource's payloads in an isolated in-memory slot.
 *
 * `env`, `tap`, and `cache` are all fixed at `App()` time;
 * `<app.Boundary>` does not accept overrides. Mutate the live Env
 * through `context.actions.produce(({ env }) => …)`, and declare a
 * separate `App` when a test or storybook needs a different initial
 * value.
 *
 * @example
 * ```tsx
 * import { App, Cache, type Taps } from "march-hare";
 *
 * type Session = { accessToken: string };
 *
 * function tap(event: Taps) {
 *   if (event.type === "error") {
 *     Sentry.captureException(event.error, { tags: { action: event.action } });
 *   }
 * }
 *
 * export const app = App({
 *   env: {
 *     session: null as Session | null,
 *     operating: "idle" as "idle" | "signing-out",
 *   },
 *   tap,
 *   cache: Cache({
 *     get: (key) => localStorage.getItem(key),
 *     set: (key, value) => localStorage.setItem(key, value),
 *     remove: (key) => localStorage.removeItem(key),
 *     clear: () => localStorage.clear(),
 *   }),
 * });
 *
 * // Root render.
 * <app.Boundary>
 *   <Root />
 * </app.Boundary>;
 *
 * // In resources.ts &mdash; persisted via the App's cache.
 * export const user = app.Resource<User>((context) =>
 *   ky
 *     .get("/api/user", {
 *       headers: context.env.session
 *         ? { Authorization: `Bearer ${context.env.session.accessToken}` }
 *         : {},
 *       signal: context.controller.signal,
 *     })
 *     .json<User>(),
 * );
 * ```
 */
export function App<S extends object = Env>(config?: {
  env?: S;
  tap?: Tap;
  cache?: Cache;
}): App<S> {
  function Boundary({
    children,
  }: {
    children: React.ReactNode;
  }): React.ReactElement {
    return (
      <BaseBoundary env={config?.env as Env} tap={config?.tap}>
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

  function useTypedEnv(): Readonly<S> {
    return baseUseEnv() as unknown as Readonly<S>;
  }

  function Resource<T, P extends object = Record<never, never>>(
    fetcher: AppFetcher<S, T, P>,
  ): ResourceHandle<T, P> {
    return BaseResource<S, T, P>(fetcher, config?.cache);
  }

  return {
    Boundary,
    useContext: useTypedContext,
    useEnv: useTypedEnv,
    Resource,
    Scope<MulticastActions>() {
      return createScope<S, MulticastActions>(config?.cache);
    },
  };
}

/**
 * Standalone counterpart to `app.useContext`, exported as
 * `shared.useContext` &mdash; same call shape, but takes the **Env
 * shape `E` as a mandatory first generic** so the caller can be a
 * reusable component that isn't tied to a single `App` import.
 *
 * `E` is the Env type your component expects to see &mdash; usually
 * a union of every App's Env shape it might run under. Inside the
 * handler, `context.env` is typed as `E`; reach for `in` / `typeof`
 * narrowing for keys present on only a subset.
 *
 * Pass `app` directly if you only need to talk to one App &mdash;
 * `app.useContext<Model, typeof Actions>()` is shorter and infers the
 * Env from the value. Reach for the standalone form only when a
 * component must support more than one App.
 *
 * @template E The Env shape (or union) the component supports.
 * @template M The model type, or `void`.
 * @template AC The Actions class, or `void`.
 * @template D The reactive data type returned from the `useActions`
 *   data callback.
 *
 * @example
 * ```tsx
 * import { Action, shared } from "march-hare";
 *
 * type WebEnv = { session: Session | null; locale: string };
 * type MobileEnv = { session: Session | null; platform: "ios" | "android" };
 * type Envs = WebEnv | MobileEnv;
 *
 * type Model = { name: string | null };
 * const model: Model = { name: null };
 *
 * class Actions {
 *   static Sign = Action<string>("Sign");
 * }
 *
 * function useProfileActions() {
 *   const context = shared.useContext<Envs, Model, typeof Actions>();
 *   const actions = context.useActions(model);
 *
 *   actions.useAction(Actions.Sign, (context, name) =>
 *     context.actions.produce(({ model }) => void (model.name = name)),
 *   );
 *
 *   return actions;
 * }
 * ```
 */
export function useContext<
  E extends object,
  M extends Model | void = void,
  A extends Actions | void = void,
  D extends Props = Props,
>(): AppContextHandle<M, A, D, E> {
  return baseUseContext() as unknown as AppContextHandle<M, A, D, E>;
}

/**
 * Standalone counterpart to `app.useEnv`, exported as `shared.useEnv`
 * &mdash; reads the nearest `<app.Boundary>`'s Env, typed against the
 * Env shape `E` supplied at the call site. For reusable components
 * that need an Env read outside any action handler (e.g. to hand a
 * closure to an external library at module bridge time).
 *
 * @template E The Env shape (or union) the component supports.
 *
 * @example
 * ```tsx
 * import { shared } from "march-hare";
 *
 * type WebEnv = { session: Session | null };
 * type MobileEnv = { session: Session | null };
 *
 * function SessionBadge() {
 *   const env = shared.useEnv<WebEnv | MobileEnv>();
 *   return <span>{env.session ? env.session.user.name : "Signed out"}</span>;
 * }
 * ```
 */
export function useEnv<E extends object>(): Readonly<E> {
  return baseUseEnv() as unknown as Readonly<E>;
}
