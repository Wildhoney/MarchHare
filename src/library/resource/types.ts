import { config } from "./utils.ts";

/**
 * Nominal type of the module-private `unset` sentinel held in
 * `config.unset`. Used on `ResourceHandle.data` so the
 * "no run yet" state is distinguishable from a fetcher that
 * legitimately resolved with `null`.
 *
 * @internal
 */
export type Unset = typeof config.unset;

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
 * Fetcher signature accepted by `Resource`. Receives the optional
 * `AbortSignal` first (threaded from the action handler's
 * `context.task.controller.signal`) and the call-site `params` second.
 * Side-effects (dispatching broadcasts, analytics, etc.) belong in the
 * calling `useAction` handler, not inside the fetcher.
 */
export type ResourceFetcher<T, P extends object = Record<never, never>> = (
  signal: AbortSignal | undefined,
  params: P,
) => Promise<T>;

/**
 * Module-scope handle returned by `Resource`. Pass to `useResource` to
 * obtain the bound, component-scoped callable.
 *
 * Every call to the underlying fetcher fires its own request. The most
 * recent successful response is cached in a module-level `WeakMap`
 * keyed by the fetcher itself, so `.if(...)` and `.else(...)` on the
 * bound handle have something to read from.
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = {
  /** @internal */
  readonly run: (signal: AbortSignal | undefined, params: P) => Promise<T>;
  /**
   * Most recent successfully-resolved payload, or the internal `unset`
   * sentinel if no successful run has happened yet.
   * @internal
   */
  readonly data: T | Unset;
  /** @internal */
  readonly at: Temporal.Instant | null;
};

/**
 * Component-bound handle returned by `useResource`. The handle is itself
 * the fetch callable &mdash; `await user(signal?, params?)` triggers a
 * request &mdash; with two attached methods:
 *
 * - `.if({ over }, signal?, params?)` &mdash; fetch only if the cached
 *   payload is older than the supplied freshness window; otherwise
 *   return the cached payload synchronously.
 * - `.else(fallback)` &mdash; synchronous read of the cached payload,
 *   falling back to the supplied default when nothing has resolved
 *   successfully yet.
 *
 * Call signature: `(signal?)` for resources with no params, or
 * `(signal: AbortSignal | null, params: P)` for parameterised
 * resources &mdash; pass `null` as the first argument when you have
 * params but no signal to thread.
 */
export type BoundResourceHandle<T, P extends object> = [keyof P] extends [never]
  ? {
      (signal?: AbortSignal): Promise<T>;
      /**
       * Calls the underlying fetcher if the most recent successful run
       * resolved longer ago than `options.over`. Otherwise returns the
       * cached data without hitting the network.
       */
      readonly if: (options: IfOptions, signal?: AbortSignal) => Promise<T>;
      /**
       * Returns the cached payload from the most recent successful run,
       * or `fallback` if no run has succeeded yet. Cached `null` values
       * are *not* treated as missing &ndash; they are returned verbatim.
       */
      readonly else: <U>(fallback: U) => T | U;
    }
  : {
      (signal: AbortSignal | null, params: P): Promise<T>;
      /**
       * Calls the underlying fetcher if the most recent successful run
       * resolved longer ago than `options.over`. Otherwise returns the
       * cached data without hitting the network.
       */
      readonly if: (
        options: IfOptions,
        signal: AbortSignal | null,
        params: P,
      ) => Promise<T>;
      /**
       * Returns the cached payload from the most recent successful run,
       * or `fallback` if no run has succeeded yet. Cached `null` values
       * are *not* treated as missing &ndash; they are returned verbatim.
       */
      readonly else: <U>(fallback: U) => T | U;
    };
