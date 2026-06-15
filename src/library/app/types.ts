import type { Args } from "../resource/types.ts";
import type { ResourceHandle } from "../resource/types.ts";
import type {
  Actions,
  Context,
  Model,
  Props,
  UseActions,
} from "../types/index.ts";
import type { Data } from "../actions/types.ts";
import type { Env } from "../boundary/components/env/index.tsx";
import type { WithHandle } from "../with/index.ts";

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
 */
export type AppResource<E> = <T, P extends object = Record<never, never>>(
  fetcher: AppFetcher<E, T, P>,
) => ResourceHandle<T, P>;

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
