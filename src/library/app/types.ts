import type { Args } from "../resource/types.ts";
import type { LocalResourceHandle, ResourceHandle } from "../resource/types.ts";
import type {
  Actions,
  Context,
  Model,
  Props,
  UseActions,
} from "../types/index.ts";
import type { Data } from "../actions/types.ts";
import type { Env } from "../boundary/components/env/types.ts";
import type { WithHandle } from "../with/types.ts";

/**
 * Args object passed to an `app.Resource` fetcher. Same shape as the
 * base `Resource` fetcher's args but with `env` typed as `E`.
 */
export type AppArgs<E, P extends object = Record<never, never>> = Omit<
  Args<P>,
  "env"
> & {
  readonly env: Readonly<E>;
};

/**
 * Fetcher signature for an `app.Resource` declaration. The fetcher's
 * `context.env` is typed against the App's inferred Env shape `E`.
 */
export type AppFetcher<E, T, P extends object = Record<never, never>> = (
  context: AppArgs<E, P>,
) => Promise<T>;

/**
 * `app.Resource(fetcher)` declares a remote interaction bound to the
 * App's Env shape. Cache behaviour is decided at App construction:
 * pass `App({ cache })` to share a single {@link Cache} (typically
 * backed by `localStorage`/MMKV) across every resource on the App, or
 * omit it to keep each resource's payloads in an isolated in-memory
 * slot.
 *
 * `app.Resource()` with **no fetcher** declares a local Resource on
 * the same App &mdash; identical cache, broadcast, eviction, and
 * persistence machinery, but written exclusively through
 * `context.actions.resource(...).set(value)`. Declare local Resources
 * through an `App({ cache })` when the values must survive reloads.
 */
export type AppResource<E> = {
  <T, P extends object = Record<never, never>>(): LocalResourceHandle<T, P>;
  <T, P extends object = Record<never, never>>(
    fetcher: AppFetcher<E, T, P>,
  ): ResourceHandle<T, P>;
};

/**
 * Tuple shape returned by `context.useActions(...)` on an App-bound
 * Context. Re-exports the base {@link UseActions} with the App's `E`
 * threaded through every `HandlerContext` and produce draft.
 */
type AppActionsResult<M, AC, D, E> = UseActions<
  M extends Model | void ? M : void,
  AC extends Actions | void ? AC : void,
  D extends Props ? D : Props,
  E extends Env ? E : Env
>;

/**
 * `useActions(...)` signature on the App-bound Context. Has two forms:
 * void-model components omit the model argument entirely; everyone else
 * passes their initial model as the first argument and an optional data
 * callback as the second.
 */
type AppUseActions<M, AC, D, E> = M extends void
  ? (getData?: Data<D & Props>) => AppActionsResult<M, AC, D, E>
  : (model: M, getData?: Data<D & Props>) => AppActionsResult<M, AC, D, E>;

/**
 * Returned from {@link App}. Bundles the Boundary, hooks, and Resource
 * factory bound to a single typed Env shape `E`.
 */
export type AppHandle<E extends object> = {
  /**
   * Boundary component for this App. Wraps the subtree with the `env`
   * and `tap` declared on {@link App} &mdash; both are fixed at App
   * construction time and cannot be overridden at the render site.
   * Runtime mutations to the Env flow through
   * `context.actions.produce(({ env }) => { ... })`; if a test or
   * storybook needs a different initial Env, declare a separate `App`.
   */
  readonly Boundary: import("react").FC<{
    children: import("react").ReactNode;
  }>;
  /**
   * Hook returning a stable `Context` handle. The handle's
   * `context.useActions(model?, getData?)` materialises the
   * component's `[model, actions, data]` tuple. Every handler's
   * `context.env` is typed as `E`.
   */
  readonly useContext: <
    M extends Model | void = void,
    AC extends Actions | void = void,
    D extends Props = Props,
  >() => AppContextHandle<M, AC, D, E>;
  /**
   * Read-only Proxy over the per-Boundary Env, typed as `E`. Reads use
   * dot notation (`env.session`) and always reflect the latest value
   * across `await` boundaries. Writes flow through
   * `context.actions.produce(({ env }) => { ... })`.
   */
  readonly useEnv: () => Readonly<E>;
  /**
   * `Resource` factory bound to this App's Env. Resources declared
   * through this factory share the cache passed to `App({ cache })`
   * &mdash; or fall back to a per-resource in-memory slot when no
   * cache is configured on the App.
   */
  readonly Resource: AppResource<E>;
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
  readonly Scope: <
    MulticastActions,
  >() => import("../scope/types.ts").ScopeHandle<E, MulticastActions>;
};

/**
 * `Context` handle returned by `app.useContext()`. Mirrors the base
 * {@link Context} but threads the App's Env shape `E` through every
 * handler's `context.env` and produce draft.
 *
 * @template M The model type for the component's state, or `void`.
 * @template AC The actions class containing this component's action
 *   definitions, or `void` for actions-only consumers.
 * @template D The reactive data type returned from the `useActions(...)`
 *   data callback.
 * @template E The App's Env shape, supplied at `App({env})` time.
 */
export type AppContextHandle<M, AC, D, E> = {
  /**
   * Stable dispatch surface available before `useActions(...)` runs.
   * Exposes only `dispatch(action, payload?)` &mdash; useful when an
   * external imperative library needs a dispatch callback at construction
   * time. Inside handlers, prefer `context.actions.dispatch` for the same
   * call.
   */
  readonly actions: {
    dispatch: Context<
      M extends Model | void ? M : void,
      AC extends Actions | void ? AC : void,
      D extends Props ? D : Props
    >["actions"]["dispatch"];
  };
  /**
   * Typed bag of handler factories bound to `M`. Methods accept
   * lodash-style dotted paths and array indices; keys autocomplete from
   * the model declared on `app.useContext<Model, …>()`. See
   * {@link WithHandle}.
   */
  readonly with: WithHandle<M extends Model | void ? M : void>;
  /**
   * Materialises the component-local model and reactive data, returning
   * the `[model, actions, data]` tuple with `useAction`, `dispatch`,
   * `inspect`, and `stream` attached. Pass the initial model as the first
   * argument (unless `M` is `void`) and an optional data callback as the
   * second &mdash; the callback re-runs every render so handlers reading
   * `context.data` always see fresh values across `await` boundaries.
   */
  readonly useActions: AppUseActions<M, AC, D, E>;
};
