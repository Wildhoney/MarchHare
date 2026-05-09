import type {
  BroadcastPayload,
  ChanneledAction,
  Filter,
  Props,
} from "../types/index.ts";

/**
 * Options accepted by `fetch.unless(...)`.
 *
 * - `within` &ndash; a duration in milliseconds. If a successful fetch
 *   resolved within this window, the cached value is returned without
 *   hitting the network. Otherwise `fetch(...)` is called normally.
 *
 * Pass a raw number (e.g. `60_000` for one minute), or wrap a string
 * with the optional [`ms`](https://github.com/vercel/ms) package at the
 * call site &mdash; e.g. `unless({ within: ms("5m") })`.
 */
export type UnlessOptions = {
  readonly within: number;
};

/**
 * Fan-out dispatcher passed to a {@link Resource}'s `onSuccess` and
 * `onError` callbacks. Restricted to broadcast actions (and channeled
 * broadcasts) because resource-level events have no single owning
 * component to scope unicast or multicast to.
 */
export type ResourceDispatch = {
  <P>(action: BroadcastPayload<P>, payload?: P): Promise<void>;
  <P, C extends Filter>(
    action: ChanneledAction<P, C>,
    payload?: P,
  ): Promise<void>;
};

/**
 * Context passed to a {@link Resource}'s `onSuccess` callback after a
 * successful fetch.
 */
export type ResourceSuccess<T> = {
  /** The resolved value from the fetcher. */
  readonly response: T;
  /** The reactive `data` proxy of the component that triggered the fetch. */
  readonly data: Props;
  /** Pre-bound dispatcher for the surrounding Boundary's broadcaster. */
  readonly dispatch: ResourceDispatch;
};

/**
 * Context passed to a {@link Resource}'s `onError` callback after a
 * failed fetch.
 */
export type ResourceFailure<E> = {
  /** The thrown error, narrowed to the second generic on `Resource`. */
  readonly error: E;
  /** The reactive `data` proxy of the component that triggered the fetch. */
  readonly data: Props;
  /** Pre-bound dispatcher for the surrounding Boundary's broadcaster. */
  readonly dispatch: ResourceDispatch;
};

/**
 * Component-bound `fetch` callable returned by `actions.useResource`. It
 * is invokable like the underlying fetcher (`fetch(...args)`) and also
 * carries an `unless` method that short-circuits the network call when
 * the cached value is still within a freshness window.
 */
export type BoundFetch<T, Args extends readonly unknown[]> = {
  (...args: Args): Promise<T>;
  /**
   * Returns the cached value if a successful fetch resolved within
   * `options.within` (parsed by [`ms`](https://github.com/vercel/ms)),
   * otherwise calls `fetch(...args)`.
   *
   * @example
   * ```ts
   * const user = actions.useResource(resource.user);
   * const data = await user.fetch.unless({ within: "5m" });
   * ```
   */
  unless(options: UnlessOptions, ...args: Args): Promise<T>;
};

/**
 * Module-scope handle returned by {@link Resource}. Pass to
 * `actions.useResource(handle)` inside a component to obtain a
 * `{ fetch, cache, fetched }` object bound to the surrounding
 * Boundary's broadcaster and the component's reactive `data`.
 */
export type ResourceHandle<
  T,
  E = Error,
  Args extends readonly unknown[] = [],
> = {
  readonly key: string;
  /** @internal */
  readonly fetch: (
    dispatch: ResourceDispatch,
    data: Props,
    ...args: Args
  ) => Promise<T>;
  /** Most recent successful response across all arg-tuples, or `null`. */
  readonly cache: T | null;
  /** Timestamp of the most recent successful fetch, or `null`. */
  readonly fetched: Date | null;
  /** @internal — phantom marker so TS distinguishes by error type */
  readonly _error?: E;
  /** @internal — phantom marker so TS distinguishes by args */
  readonly _args?: Args;
};

/**
 * Defines a remote resource &mdash; declare at module scope and consume via
 * `actions.useResource(handle)`. Mirrors the {@link Action} factory pattern:
 * the declaration is a value, not a hook.
 *
 * The fetcher may take arguments. The `fetch` method returned by
 * `actions.useResource` forwards them, and in-flight dedup keys per
 * arg-tuple &ndash; so `feed.fetch(null)` and `feed.fetch("abc")` run
 * independently, while two concurrent `feed.fetch("abc")` calls share
 * one network request.
 *
 * Each call to `fetch()` always hits the network; `cache` and `fetched`
 * are read-only snapshots of the most recent successful response &ndash;
 * not a memoised result. Coordination across components happens via the
 * broadcast actions dispatched in `onSuccess` / `onError`.
 *
 * @example
 * ```ts
 * import { Resource } from "chizu";
 *
 * export const feed = Resource<Page<Item>, ApiError, [cursor: string | null]>(
 *   "feed",
 *   (cursor) =>
 *     http.get("feed", { searchParams: { cursor: cursor ?? "" } }).json(),
 *   ({ response, dispatch }) =>
 *     dispatch(Actions.Broadcast.PageLoaded, response),
 * );
 * ```
 */
export function Resource<T, E = Error, Args extends readonly unknown[] = []>(
  key: string,
  fetcher: (...args: Args) => Promise<T>,
  onSuccess?: (context: ResourceSuccess<T>) => void,
  onError?: (context: ResourceFailure<E>) => void,
): ResourceHandle<T, E, Args> {
  const inflight = new Map<string, Promise<T>>();
  let cache: T | null = null;
  let fetched: Date | null = null;

  const fetchWith = (
    dispatch: ResourceDispatch,
    data: Props,
    ...args: Args
  ): Promise<T> => {
    const argKey = JSON.stringify(args);
    const existing = inflight.get(argKey);
    if (existing) return existing;

    const promise = fetcher(...args).then(
      (response) => {
        if (inflight.get(argKey) === promise) inflight.delete(argKey);
        cache = response;
        fetched = new Date();
        onSuccess?.({ response, data, dispatch });
        return response;
      },
      (error: unknown) => {
        if (inflight.get(argKey) === promise) inflight.delete(argKey);
        onError?.({ error: <E>error, data, dispatch });
        throw error;
      },
    );
    inflight.set(argKey, promise);
    return promise;
  };

  return {
    key,
    fetch: fetchWith,
    get cache() {
      return cache;
    },
    get fetched() {
      return fetched;
    },
  };
}
