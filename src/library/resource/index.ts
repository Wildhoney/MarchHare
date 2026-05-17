/**
 * Options accepted by `.if(...)` on a bound resource handle.
 *
 * - `over` &ndash; a `Temporal.Duration`, a `DurationLike` object
 *   (e.g. `{ minutes: 5 }`), or an ISO 8601 duration string (`"PT5M"`).
 *   If the most recent successful run resolved longer ago than this
 *   window, the underlying fetcher is called. Otherwise the cached
 *   data is returned without hitting the network.
 *
 * @example
 * ```ts
 * await user.if({ over: { minutes: 5 } });
 * await user.if({ over: "PT5M" });
 * await user.if({ over: Temporal.Duration.from({ minutes: 5 }) });
 * ```
 */
export type IfOptions = {
  readonly over: Temporal.DurationLike;
};

/**
 * Fetcher signature accepted by {@link Resource}. Receives the
 * call-site `params` object and returns a `Promise` of the response.
 * Side-effects (dispatching broadcasts, analytics, etc.) belong in the
 * calling `useAction` handler, not inside the fetcher.
 */
export type ResourceFetcher<T, P extends object = Record<never, never>> = (
  params: P,
) => Promise<T>;

/**
 * Module-scope handle returned by {@link Resource}. Pass to
 * `actions.useResource(handle)` to obtain the bound, component-scoped
 * callable.
 *
 * Every call to the underlying fetcher fires its own request. The most
 * recent successful response is cached in a module-level `WeakMap`
 * keyed by the fetcher itself, so `.if(...)` and `.else(...)` on the
 * bound handle have something to read from.
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = {
  /** @internal */
  readonly run: (params: P) => Promise<T>;
  /** @internal */
  readonly data: T | null;
  /** @internal */
  readonly at: Temporal.Instant | null;
};

/**
 * Component-bound handle returned by `actions.useResource`. The handle
 * is itself the fetch callable &mdash; `await user()` triggers a
 * request &mdash; with two attached methods:
 *
 * - `.if({ over })` &mdash; fetch only if the cached payload is older
 *   than the supplied freshness window; otherwise return the cached
 *   payload synchronously (wrapped in a resolved promise).
 * - `.else(fallback)` &mdash; synchronous read of the cached payload,
 *   falling back to the supplied default when nothing has resolved
 *   successfully yet.
 *
 * The call signature collapses when `P` is empty &mdash; `user()`
 * instead of `user({})`.
 */
export type BoundResourceHandle<T, P extends object> = [keyof P] extends [never]
  ? {
      (): Promise<T>;
      /**
       * Calls the underlying fetcher if the most recent successful run
       * resolved longer ago than `options.over`. Otherwise returns the
       * cached data without hitting the network.
       */
      readonly if: (options: IfOptions) => Promise<T>;
      /**
       * Returns the cached payload from the most recent successful run,
       * or `fallback` if no run has succeeded yet.
       */
      readonly else: <U>(fallback: U) => T | U;
    }
  : {
      (params: P): Promise<T>;
      /**
       * Calls the underlying fetcher if the most recent successful run
       * resolved longer ago than `options.over`. Otherwise returns the
       * cached data without hitting the network.
       */
      readonly if: (options: IfOptions, params: P) => Promise<T>;
      /**
       * Returns the cached payload from the most recent successful run,
       * or `fallback` if no run has succeeded yet.
       */
      readonly else: <U>(fallback: U) => T | U;
    };

type CacheEntry = {
  data: unknown;
  at: Temporal.Instant | null;
};

const cache = new WeakMap<object, CacheEntry>();

/**
 * Defines a remote resource &mdash; declared at module scope and
 * consumed via `actions.useResource(handle)`.
 *
 * The fetcher takes a single `params` argument (defaults to `{}`) and
 * returns a `Promise<T>`. Resources do **not** carry any callbacks
 * &ndash; side-effects (broadcasting, logging, model updates) belong
 * in the `useAction` handler that called `await handle(...)`.
 *
 * Every call fires its own request. The most recent successful
 * payload is cached in a module-level `WeakMap` keyed by the fetcher,
 * so `.if(...)` and `.else(...)` on the bound handle behave
 * consistently across all components that share the same Resource.
 *
 * @example
 * ```ts
 * import { Resource } from "march-hare";
 *
 * export const user = Resource<User>(() => ky.get("user").json<User>());
 *
 * export const pay = Resource<Receipt, Body>((body) =>
 *   ky.post("pay", { json: body }).json<Receipt>(),
 * );
 * ```
 */
export function Resource<T, P extends object = Record<never, never>>(
  fetcher: ResourceFetcher<T, P>,
): ResourceHandle<T, P> {
  const run = (params: P): Promise<T> =>
    fetcher(params).then((resolved) => {
      cache.set(fetcher, { data: resolved, at: Temporal.Now.instant() });
      return resolved;
    });

  return {
    run,
    get data() {
      return <T | null>(cache.get(fetcher)?.data ?? null);
    },
    get at() {
      return cache.get(fetcher)?.at ?? null;
    },
  };
}
