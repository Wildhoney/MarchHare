import type { Unset } from "../utils/index.ts";
import type { Store } from "../boundary/components/store/index.tsx";

export type { Unset } from "../utils/index.ts";

/**
 * Args object passed to every {@link ResourceFetcher}. The fetcher
 * destructures whatever it needs; unused fields can be omitted.
 *
 * - `store` &mdash; snapshot of the per-`<Boundary>` Store at the
 *   moment the fetcher is invoked.
 * - `signal` &mdash; the `AbortSignal` auto-threaded from the calling
 *   handler's `context.task.controller.signal`.
 * - `params` &mdash; the call-site params object. Defaults to `{}`.
 */
export type FetcherArgs<P extends object = Record<never, never>> = {
  readonly store: Store;
  readonly signal: AbortSignal | undefined;
  readonly params: P;
};

/**
 * Fetcher signature accepted by `Resource`. Receives the args object
 * `{ store, signal, params }`. Side-effects (dispatching broadcasts,
 * analytics, etc.) belong in the calling `useAction` handler, not
 * inside the fetcher.
 */
export type ResourceFetcher<T, P extends object = Record<never, never>> = (
  args: FetcherArgs<P>,
) => Promise<T>;

/**
 * Module-scope handle returned by `Resource`. Exposes:
 *
 * - `.get(params)` &mdash; synchronous read of the cached payload for
 *   `params`, or `null` when nothing has resolved yet. Safe to call at
 *   module scope or inside the model literal.
 *
 * Fetching goes through `context.actions.resource(resource, params?,
 * over?)` from an action handler &mdash; that path auto-threads the
 * abort signal and the Store snapshot.
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = {
  readonly get: [keyof P] extends [never]
    ? (params?: P) => T | null
    : (params: P) => T | null;
  /**
   * Invokes the fetcher with the supplied Store snapshot, abort signal,
   * and params. Writes the resolved payload to the per-params cache
   * slot before returning. Not for direct use &mdash; call
   * `context.actions.resource(resource, params?, over?)` from a handler
   * instead.
   * @internal
   */
  readonly run: (
    store: Store,
    signal: AbortSignal | undefined,
    params: P,
  ) => Promise<T>;
  /**
   * Reads the per-params cache slot raw, returning the {@link Stored}
   * pieces (`data` plus `at`). Used by `context.actions.resource` to
   * check the freshness window. Prefer `.get(params)` from user code.
   * @internal
   */
  readonly read: (params: P) => {
    data: T | Unset;
    at: Temporal.Instant | null;
  };
  /**
   * Populates the per-params cache slot with `data` and `at` without
   * invoking the fetcher. Used by tests and for manual hydration.
   * @internal
   */
  readonly seed: (params: P, data: T, at: Temporal.Instant) => void;
};
