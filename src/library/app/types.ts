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
import type { Env } from "../boundary/components/env/index.tsx";

/**
 * Args object passed to an `app.Resource` fetcher. Same shape as the
 * base `Resource` fetcher's args but with `env` typed as `S`.
 */
export type AppArgs<S, P extends object = Record<never, never>> = Omit<
  Args<P>,
  "env"
> & {
  readonly env: Readonly<S>;
};

/**
 * Fetcher signature for an `app.Resource` declaration. The fetcher's
 * `context.env` is typed against the App's inferred Env shape `S`.
 */
export type AppFetcher<S, T, P extends object = Record<never, never>> = (
  context: AppArgs<S, P>,
) => Promise<T>;

/**
 * `app.Resource(fetcher)` &mdash; in-memory cache, no persistence.
 * `app.Resource.Cachable(cache, fetcher)` &mdash; persistent cache wired
 * to the supplied `Cache` adapter. Both forms type `context.env` as
 * the App's Env shape.
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

type AppActionsResult<M, AC, D, S> = UseActions<
  M extends Model | void ? M : void,
  AC extends Actions | void ? AC : void,
  D extends Props ? D : Props,
  S extends Env ? S : Env
>;

type AppUseActions<M, AC, D, S> = M extends void
  ? (getData?: Data<D & Props>) => AppActionsResult<M, AC, D, S>
  : (model: M, getData?: Data<D & Props>) => AppActionsResult<M, AC, D, S>;

/**
 * `Context` handle returned by `app.useContext()`. Mirrors the base
 * {@link Context} but threads `S` through every handler's
 * `context.env` and `produce` draft.
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
