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
 * Descriptor produced by calling a Resource handle. Carries the per-call
 * `params` together with the closures `context.actions.resource(...)`
 * needs to run, read, or evict the slot. Pass it straight to
 * `context.actions.resource(invocation)` &mdash; no module-level state
 * sits between the producer and the consumer, so two synchronous calls
 * to the same Resource are independent values that can be stored,
 * deferred, or passed across `await` boundaries safely.
 *
 * @internal
 */
export type Invocation<T, P extends object = Record<never, never>> = {
  readonly run: (
    env: Env,
    controller: AbortController,
    params: object,
    dispatch: Dispatch,
  ) => Promise<T>;
  readonly read: (params: object) => {
    data: T | symbol;
    at: Temporal.Instant | null;
  };
  readonly evict: (where: object) => void;
  readonly params: P;
};

/**
 * Resource handle returned by `Resource(...)` (or its `app.Resource` /
 * `shared.Resource` counterparts). Call it with `params` to produce an
 * {@link Invocation} suitable for `context.actions.resource(...)`. Use
 * `.get(params)` for a synchronous cache read.
 *
 * - `resource.cat.get({id: 5})` &mdash; sync read, returns `T | null`.
 * - `context.actions.resource(resource.cat({id: 5}))` &mdash; fetch.
 * - `context.actions.resource(resource.cat({id: 5})).evict()` &mdash;
 *   drop the `{id: 5}` slot.
 * - `context.actions.resource(resource.cat()).evict({name: "Adam"})`
 *   &mdash; evict every cached `cat` entry whose stored params include
 *   `name: "Adam"`, regardless of other keys.
 * - `context.actions.resource.nuke({id: 5})` &mdash; partial-match
 *   eviction across every resource on the App; nuke with no argument
 *   clears every known slot.
 *
 * ```ts
 * // Sync cache read in a model literal.
 * { cat: resource.cat.get({ id: 5 }) }
 *
 * // Fetch with `.exceeds(...)` for cache-aware refresh.
 * await context.actions
 *   .resource(resource.cat({ id: 5 }))
 *   .exceeds({ minutes: 5 });
 *
 * // Evict the {id: 5} slot.
 * context.actions.resource(resource.cat({ id: 5 })).evict();
 * ```
 */
export type ResourceHandle<T, P extends object = Record<never, never>> = ([
  keyof P,
] extends [never]
  ? (params?: P) => Invocation<T, P>
  : (params: P) => Invocation<T, P>) & {
  readonly get: [keyof P] extends [never]
    ? (params?: P) => T | null
    : (params: P) => T | null;
};

/**
 * Drops cache slots whose stored params match the supplied `where`
 * pattern. Each Resource registers one of these on declaration so
 * `nuke(where)` can iterate them.
 *
 * @internal
 */
export type ResourceEvictor = (where: object) => void;
