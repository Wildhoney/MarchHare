/**
 * Options accepted by `run.if(...)`.
 *
 * - `over` &ndash; a `Temporal.Duration`, a `DurationLike` object
 *   (e.g. `{ minutes: 5 }`), or an ISO 8601 duration string (`"PT5M"`).
 *   If the most recent successful run resolved longer ago than this
 *   window, `run(...)` is called. Otherwise the cached data is returned
 *   without hitting the network.
 *
 * @example
 * ```ts
 * await user.run.if({ over: { minutes: 5 } });
 * await user.run.if({ over: "PT5M" });
 * await user.run.if({ over: Temporal.Duration.from({ minutes: 5 }) });
 * ```
 */
export type IfOptions = {
  readonly over: Temporal.DurationLike;
};

/**
 * Fetcher signature accepted by {@link Resource}. Receives the
 * call-site `params` object and returns a `Promise` of the response.
 * Side-effects (dispatching broadcasts, analytics, etc.) belong in
 * the calling `useAction` handler, not inside the fetcher.
 */
export type ResourceFetcher<T, P extends object = Record<never, never>> = (
  params: P,
) => Promise<T>;

/**
 * Component-bound `run` callable returned by `actions.useResource`. It
 * is invokable like the underlying fetcher (`run(params)`) and also
 * carries an `if` method that triggers the network call only when the
 * cached data is older than the supplied freshness window.
 *
 * The conditional specialisation collapses the call signature when
 * `P` is empty &mdash; `run()` instead of `run({})`.
 */
export type BoundRun<T, P extends object> = [keyof P] extends [never]
  ? {
      (): Promise<T>;
      /**
       * Calls `run()` if the most recent successful run resolved longer
       * ago than `options.over`. Otherwise returns the cached data.
       */
      readonly if: (options: IfOptions) => Promise<T>;
    }
  : {
      (params: P): Promise<T>;
      /**
       * Calls `run(params)` if the most recent successful run resolved
       * longer ago than `options.over`. Otherwise returns the cached data.
       */
      readonly if: (options: IfOptions, params: P) => Promise<T>;
    };

/**
 * Module-scope handle returned by {@link Resource}. Pass to
 * `actions.useResource(handle)` inside a component to obtain a
 * `{ run, data, at }` object.
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = {
  readonly key: string;
  /** @internal */
  readonly run: (params: P) => Promise<T>;
  /** Most recent successful data across all param-sets, or `null`. */
  readonly data: T | null;
  /** Instant of the most recent successful run, or `null`. */
  readonly at: Temporal.Instant | null;
};

/**
 * Defines a remote resource &mdash; declare at module scope and consume
 * via `actions.useResource(handle)`. Mirrors the {@link Action} factory
 * pattern: the declaration is a value, not a hook.
 *
 * The fetcher takes a single `params` argument (defaults to `{}`) and
 * returns a `Promise<T>`. Resources do **not** carry any callbacks
 * &ndash; any side-effects the caller wants on success or failure
 * (broadcasting, logging, model updates) belong in the `useAction`
 * handler that called `await user.run(...)`.
 *
 * `params` are typed via the second generic and forwarded to every
 * `run(params)` call site. In-flight dedup keys per params shape, so
 * `feed.run({ cursor: null })` and `feed.run({ cursor: "abc" })` execute
 * independently while two concurrent `feed.run({ cursor: "abc" })` calls
 * share one network request.
 *
 * Each call to `run()` always hits the network; `data` and `at`
 * are read-only snapshots of the most recent successful payload and
 * the instant it resolved &ndash; not a memoised result.
 *
 * @example
 * ```ts
 * import { Resource } from "march-hare";
 *
 * export const feed = Resource<Page<Item>, { cursor: string | null }>(
 *   "feed",
 *   ({ cursor }) =>
 *     http
 *       .get("feed", { searchParams: { cursor: cursor ?? "" } })
 *       .json<Page<Item>>(),
 * );
 * ```
 */
export function Resource<T, P extends object = Record<never, never>>(
  key: string,
  fetcher: ResourceFetcher<T, P>,
): ResourceHandle<T, P> {
  const inflight = new Map<string, Promise<T>>();
  let data: T | null = null;
  let at: Temporal.Instant | null = null;

  const runWith = (params: P): Promise<T> => {
    const paramsKey = JSON.stringify(params);
    const existing = inflight.get(paramsKey);
    if (existing) return existing;

    const promise = fetcher(params).then(
      (resolved) => {
        if (inflight.get(paramsKey) === promise) inflight.delete(paramsKey);
        data = resolved;
        at = Temporal.Now.instant();
        return resolved;
      },
      (error: unknown) => {
        if (inflight.get(paramsKey) === promise) inflight.delete(paramsKey);
        throw error;
      },
    );
    inflight.set(paramsKey, promise);
    return promise;
  };

  return Object.freeze({
    key,
    run: runWith,
    get data() {
      return data;
    },
    get at() {
      return at;
    },
  });
}
