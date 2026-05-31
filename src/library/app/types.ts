import type { Args } from "../resource/types.ts";
import type { ResourceHandle } from "../resource/types.ts";
import type { Cache } from "../cache/index.ts";
import type {
  Actions,
  Context,
  Model,
  Props,
  UseActions,
} from "../types/index.ts";
import type { Data } from "../actions/types.ts";

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

/**
 * Phantom marker so consumers of the App's hooks see `store: S` typing
 * at the type-system level; at runtime the value is the same proxy as
 * the loose `Store` type.
 *
 * @internal
 */
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
