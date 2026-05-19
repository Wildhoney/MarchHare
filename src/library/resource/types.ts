import type { Stored, Unset } from "../utils/index.ts";

export type { Unset } from "../utils/index.ts";

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
   * Most recent successfully-resolved payload, or the shared `unset`
   * sentinel if no successful run has happened yet.
   * @internal
   */
  readonly data: T | Unset;
  /** @internal */
  readonly at: Temporal.Instant | null;
  /**
   * Populates the cache slot with `data` and `at` without invoking the
   * fetcher. Used by the bound handle's `.else(stored)` overload to
   * hydrate the cache from a {@link Stored} fallback (typically the
   * return value of `Store.get(key)` after a page reload).
   * @internal
   */
  readonly seed: (data: T, at: Temporal.Instant) => void;
};

/**
 * Component-bound handle returned by `useResource`. The handle is itself
 * the fetch callable &mdash; `await user(signal?, params?)` triggers a
 * request &mdash; with attached read accessors and methods:
 *
 * - `.if({ over }, signal?, params?)` &mdash; fetch only if the cached
 *   payload is older than the supplied freshness window; otherwise
 *   return the cached payload synchronously.
 * - `.else(fallback)` &mdash; synchronous read of the cached payload,
 *   falling back to the supplied default when nothing has resolved
 *   successfully yet. Accepts either a value (terminal, returns
 *   `T | U`) or a {@link Stored} (chainable, seeds the cache from the
 *   Stored's data/at when the cache is empty and returns the same bound
 *   handle for further chaining).
 * - `.snapshot()` &mdash; returns a {@link Stored} wrapping the current
 *   cache state, symmetric with `Store.get(key)`. Pass straight to
 *   `Store.set(key, ...)` to persist the latest successful payload.
 * - `.data` and `.at` &mdash; the underlying cache fields. Reading
 *   `.snapshot()` is usually clearer.
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
       * Overloaded fallback accessor.
       *
       * - `(fallback: U)` terminal &mdash; returns the cached payload, or
       *   `fallback` when nothing has resolved yet. Cached `null` values
       *   are returned verbatim.
       * - `(stored: Stored<T>)` chainable &mdash; if the cache is empty
       *   and the Stored carries data and a timestamp, seeds the cache
       *   from it before returning the same bound handle so further
       *   `.else(...)` calls compose. Used to hydrate the cache on first
       *   render after a page reload, allowing `.if({ over })` to
       *   short-circuit on the persisted timestamp.
       */
      readonly else: {
        (stored: Stored<T>): BoundResourceHandle<T, P>;
        <U>(fallback: U): T | U;
      };
      /**
       * Snapshot of the current cache state in the shared {@link Stored}
       * shape. Empty (`data === unset`, `at === null`) until a fetcher
       * resolves; otherwise carries the most recent payload and the
       * instant it resolved. Pass directly to `Store.set(key, ...)`.
       */
      readonly snapshot: () => Stored<T>;
      /** Direct read of the cache payload. Prefer `.snapshot()`. */
      readonly data: T | Unset;
      /** Instant the cache was last populated, or `null` if empty. */
      readonly at: Temporal.Instant | null;
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
       * Overloaded fallback accessor.
       *
       * - `(fallback: U)` terminal &mdash; returns the cached payload, or
       *   `fallback` when nothing has resolved yet.
       * - `(stored: Stored<T>)` chainable &mdash; if the cache is empty
       *   and the Stored carries data and a timestamp, seeds the cache
       *   from it before returning the same bound handle.
       */
      readonly else: {
        (stored: Stored<T>): BoundResourceHandle<T, P>;
        <U>(fallback: U): T | U;
      };
      /**
       * Snapshot of the current cache state in the shared {@link Stored}
       * shape. Pass directly to `Store.set(key, ...)`.
       */
      readonly snapshot: () => Stored<T>;
      /** Direct read of the cache payload. Prefer `.snapshot()`. */
      readonly data: T | Unset;
      /** Instant the cache was last populated, or `null` if empty. */
      readonly at: Temporal.Instant | null;
    };
