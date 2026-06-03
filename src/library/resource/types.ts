import type { Env } from "../boundary/components/env/index.tsx";
import type { Cache } from "../cache/index.ts";
import type {
  BroadcastPayload,
  MulticastPayload,
  Filter,
} from "../types/index.ts";

/**
 * Dispatch surface exposed on a Resource fetcher's `context`. Restricted
 * to broadcast and multicast actions &mdash; unicast targets the calling
 * component, which a Resource fetcher does not have.
 */
export type Dispatch = {
  <C extends Filter = never>(
    action: BroadcastPayload<never, C> | MulticastPayload<never, C>,
  ): Promise<void>;
  <P, C extends Filter = never>(
    action: BroadcastPayload<P, C> | MulticastPayload<P, C>,
    payload: P,
  ): Promise<void>;
};

/**
 * `context` object passed to every {@link Fetcher}.
 *
 * - `env` &mdash; live read-only handle to the per-`<Boundary>` Env.
 *   Dot reads always reflect the latest value, even across `await`
 *   boundaries inside the fetcher &mdash; the handle is a `Proxy`
 *   that delegates property access to the live ref, identical to
 *   the `context.env` exposed to action handlers.
 * - `controller` &mdash; the `AbortController` auto-threaded from the
 *   calling handler's `context.task.controller`. Pass
 *   `controller.signal` to `fetch`/`ky`/`EventSource`, or call
 *   `controller.abort()` to fail fast.
 * - `params` &mdash; the call-site params object. Defaults to `{}`.
 * - `dispatch` &mdash; fire broadcast or multicast actions from inside
 *   the fetcher. Unicast is rejected at compile time.
 *
 * @internal
 */
export type Args<P extends object = Record<never, never>> = {
  readonly env: Env;
  readonly controller: AbortController;
  readonly params: P;
  readonly dispatch: Dispatch;
};

/**
 * Fetcher signature accepted by `Resource`. Receives a single `context`
 * argument carrying a live Env handle, the abort controller, params,
 * and a broadcast/multicast-only `dispatch`.
 */
export type Fetcher<T, P extends object = Record<never, never>> = (
  context: Args<P>,
) => Promise<T>;

/**
 * Per-call coalescing token. Two callers with the same Resource, same
 * structural params, and equal `Coalesce` value share a single in-flight
 * promise; different tokens (or different params) fire independent
 * fetches. Primitives compose naturally via stringification; objects
 * are serialised with `JSON.stringify`.
 */
export type Coalesce = string | number | bigint | boolean | symbol | object;

/**
 * Config form accepted by `Resource`. The fetcher shorthand
 * `Resource(fetcher)` is equivalent to `Resource({ fetch: fetcher })`.
 *
 * - `fetch` &mdash; the fetcher.
 * - `cache` &mdash; persist successful payloads via a {@link Cache}
 *   wired to an `Adapter` (localStorage, MMKV, etc). Omit for an
 *   in-memory cache scoped to this Resource.
 */
export type Config<T, P extends object = Record<never, never>> = {
  readonly fetch: Fetcher<T, P>;
  readonly cache?: Cache;
};

/**
 * Snapshot of the most recent resource invocation. `resource.cat(params)`
 * writes one of these into a module-scope slot; the next
 * `context.actions.resource(...)` / `.set(...)` call consumes it via
 * `consumePending` and then clears the slot.
 *
 * @internal
 */
export type PendingCall = {
  readonly run: (
    env: Env,
    controller: AbortController,
    params: object,
    dispatch: Dispatch,
  ) => Promise<unknown>;
  readonly read: (params: object) => {
    data: unknown;
    at: Temporal.Instant | null;
  };
  readonly seed: (params: object, data: unknown, at: Temporal.Instant) => void;
  readonly params: object;
};

/**
 * Resource handle returned by `Resource(...)` or `Resource.Cachable(...)`.
 * Call it with `params` to read the per-params cache slot synchronously
 * and prime the slot consumed by `context.actions.resource(...)` for a
 * follow-up fetch or `context.actions.resource.set(...)` for an
 * out-of-band write.
 *
 * ```ts
 * // Sync cache read in a model literal.
 * { cat: resource.cat({ id: 5 }) }
 *
 * // Fetch with `.exceeds(...)` for cache-aware refresh.
 * await context.actions
 *   .resource(resource.cat({ id: 5 }))
 *   .exceeds({ minutes: 5 });
 *
 * // Write through to the per-params cache slot.
 * context.actions.resource.set(resource.cat({ id: 5 }), data);
 * ```
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = [
  keyof P,
] extends [never]
  ? (params?: P) => T | null
  : (params: P) => T | null;
