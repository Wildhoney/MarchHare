/**
 * Options accepted by `run.unless(...)`.
 *
 * - `within` &ndash; a `Temporal.Duration`, a `DurationLike` object
 *   (e.g. `{ minutes: 5 }`), or an ISO 8601 duration string (`"PT5M"`).
 *   If a successful run resolved within this window, the cached
 *   response is returned without hitting the network. Otherwise
 *   `run(...)` is called normally.
 *
 * @example
 * ```ts
 * await user.run.unless({ within: { minutes: 5 } });
 * await user.run.unless({ within: "PT5M" });
 * await user.run.unless({ within: Temporal.Duration.from({ minutes: 5 }) });
 * ```
 */
export type UnlessOptions = {
  readonly within: Temporal.DurationLike;
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
 * carries an `unless` method that short-circuits the network call when
 * the cached response is still within a freshness window.
 *
 * The conditional specialisation collapses the call signature when
 * `P` is empty &mdash; `run()` instead of `run({})`.
 */
export type BoundRun<T, P extends object> = [keyof P] extends [never]
  ? {
      (): Promise<T>;
      /**
       * Returns the cached response if a successful run resolved within
       * `options.within`, otherwise calls `run()`.
       */
      unless(options: UnlessOptions): Promise<T>;
    }
  : {
      (params: P): Promise<T>;
      /**
       * Returns the cached response if a successful run resolved within
       * `options.within`, otherwise calls `run(params)`.
       */
      unless(options: UnlessOptions, params: P): Promise<T>;
    };

/**
 * Module-scope handle returned by {@link Resource}. Pass to
 * `actions.useResource(handle)` inside a component to obtain a
 * `{ run, response, at }` object.
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = {
  readonly key: string;
  /** @internal */
  readonly run: (params: P) => Promise<T>;
  /** Most recent successful response across all param-sets, or `null`. */
  readonly response: T | null;
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
 * Each call to `run()` always hits the network; `response` and `at`
 * are read-only snapshots of the most recent successful response and
 * the instant it resolved &ndash; not a memoised result.
 *
 * @example
 * ```ts
 * import { Resource } from "chizu";
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
  let response: T | null = null;
  let at: Temporal.Instant | null = null;

  const runWith = (params: P): Promise<T> => {
    const paramsKey = JSON.stringify(params);
    const existing = inflight.get(paramsKey);
    if (existing) return existing;

    const promise = fetcher(params).then(
      (resolved) => {
        if (inflight.get(paramsKey) === promise) inflight.delete(paramsKey);
        response = resolved;
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

  return {
    key,
    run: runWith,
    get response() {
      return response;
    },
    get at() {
      return at;
    },
  };
}
