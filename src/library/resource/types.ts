import type { Env } from "../boundary/components/env/types.ts";
import type { Cache } from "../cache/index.ts";
import type {
  BroadcastPayload,
  MulticastPayload,
  BroadcastChanneled,
  ChanneledAction,
  Filter,
} from "../types/index.ts";

/**
 * Channel shape accepted by {@link ResourceHandle.action}: a partial of
 * the resource's params. Keys not declared on `P` are rejected at
 * compile time, so `.action({ unknownKey: ... })` fails to type-check
 * &mdash; including the params-less case, where the channel collapses
 * to an object whose only legal value for any key is `never`.
 */
export type ActionChannel<P extends object> = [keyof P] extends [never]
  ? Record<string, never>
  : Partial<P>;

/**
 * Dispatch surface exposed on a Resource fetcher's `context`. Restricted
 * to broadcast and multicast actions &mdash; unicast targets the calling
 * component, which a Resource fetcher does not have. Channeled
 * dispatches (e.g. `dispatch(action({ UserId: 5 }), payload)`) are
 * accepted on the same overloads &mdash; the routing layer reads the
 * action's underlying distribution off its symbol.
 */
export type Dispatch = {
  <C extends Filter = never>(
    action:
      | BroadcastPayload<never, C>
      | MulticastPayload<never, C>
      | ChanneledAction<never, C>,
  ): Promise<void>;
  <P, C extends Filter = never>(
    action:
      | BroadcastPayload<P, C>
      | MulticastPayload<P, C>
      | ChanneledAction<P, C>,
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
  readonly evict: (where: object, dispatch?: Dispatch) => void;
  readonly params: P;
};

/**
 * Descriptor produced by calling a local (fetcherless) Resource handle.
 * Carries the per-call `params` together with the closures
 * `context.actions.resource(...)` needs to write, read, or evict the
 * slot. There is deliberately no `run` &mdash; a local Resource has no
 * fetcher, so the invocation is not awaitable and the fetch-path
 * chain (`.exceeds(...)`, `.isolated()`) does not exist on the
 * resulting handle. `.set(value)` is the only write path.
 *
 * @internal
 */
export type LocalInvocation<T, P extends object = Record<never, never>> = {
  readonly write: (
    env: Env,
    params: object,
    value: T,
    dispatch: Dispatch,
  ) => void;
  readonly read: (params: object) => {
    data: T | symbol;
    at: Temporal.Instant | null;
  };
  readonly evict: (where: object, dispatch?: Dispatch) => void;
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
  ? (params?: Record<string, never>) => Invocation<T, P>
  : (params: P) => Invocation<T, P>) & {
  readonly get: [keyof P] extends [never]
    ? (params?: Record<string, never>) => T | null
    : (params: P) => T | null;
  /**
   * Broadcast channeled action fired automatically after every successful
   * fetch of this Resource. Always invoke before subscribing: pass no
   * arguments to match every fetch, or a partial-params object to narrow.
   * Matching follows the subscriber-as-filter rule &mdash; every key on the
   * subscriber's channel must equal the same key on the dispatch channel,
   * and adding keys progressively narrows the filter.
   *
   * Late-mounting subscribers replay every cached entry whose channel
   * satisfies their filter &mdash; the broadcast cache is sharded by
   * `(action, channel)`, so a partial subscriber that mounts after
   * several distinct fetches catches up with all of them rather than
   * just the most recent.
   *
   * Failures do not broadcast &mdash; the cache is only written on
   * success (see resource/utils.ts), and the broadcast follows the same
   * gate.
   *
   * Eviction fires the same broadcast with a `null` payload: every
   * call to `.evict(where?)` (via `context.actions.resource(...).evict`)
   * or `context.actions.resource.nuke(where?)` walks the matching cache
   * slots and dispatches `action(evictedParams)` with `null` for each,
   * so the payload type is `T | null`.
   *
   * ```ts
   * actions.useAction(user.action(), (context, value) => {
   *   if (value === null) return;
   * });
   * actions.useAction(user.action({ id: 5 }), (context, value) => { ... });
   * actions.stream(user.action({ id: 5 }), (value) => <span>{value?.name}</span>);
   * ```
   */
  readonly action: (
    channel?: ActionChannel<P>,
  ) => BroadcastChanneled<T | null, ActionChannel<P>>;
};

/**
 * Handle returned by a fetcherless `Resource()` declaration (or its
 * `app.Resource()` / `shared.Resource()` counterparts). A local
 * Resource holds app-written values rather than endpoint payloads:
 * where a fetched Resource's cache is a materialised view of its
 * fetcher's results, a local Resource's cache is written exclusively
 * through `context.actions.resource(resource.draft(params)).set(value)`
 * &mdash; one write path per variant, so a cached value's origin is
 * always unambiguous.
 *
 * Everything else matches the fetched handle: `.get(params)` reads the
 * slot synchronously, `.action(channel?)` is the auto-broadcast fired
 * with the written value after every `.set(...)` (and with `null` on
 * every eviction), subscribers replay from the broadcast cache on late
 * mount, and slots participate in `.evict(where?)` and
 * `context.actions.resource.nuke(where?)`. Persistence follows the
 * same rule as fetched Resources &mdash; declare through `app.Resource`
 * on an `App({ cache })` to survive reloads; `shared.Resource()` is
 * always in-memory.
 *
 * Calling the handle produces a {@link LocalInvocation}, which is not
 * awaitable &mdash; there is no fetcher to run, so `.exceeds(...)` and
 * `.isolated()` do not exist on the resulting chain.
 */
export type LocalResourceHandle<T, P extends object = Record<never, never>> = ([
  keyof P,
] extends [never]
  ? (params?: Record<string, never>) => LocalInvocation<T, P>
  : (params: P) => LocalInvocation<T, P>) & {
  readonly get: [keyof P] extends [never]
    ? (params?: Record<string, never>) => T | null
    : (params: P) => T | null;
  /**
   * Broadcast channeled action fired automatically after every
   * `.set(...)` on this Resource, with the written value as the
   * payload and the call-site params as the channel. Eviction fires
   * the same broadcast with a `null` payload, so the payload type is
   * `T | null` &mdash; identical semantics to a fetched Resource's
   * `.action()`, letting subscribers stay agnostic about whether the
   * value was fetched or written locally.
   */
  readonly action: (
    channel?: ActionChannel<P>,
  ) => BroadcastChanneled<T | null, ActionChannel<P>>;
};

/**
 * Drops cache slots whose stored params match the supplied `where`
 * pattern, and &mdash; when a `dispatch` is provided &mdash; fires a
 * `null` broadcast on the Resource's `.action()` for each removed
 * slot, using the slot's stored params as the channel. Each Resource
 * registers one of these on declaration so `nuke(where)` can iterate
 * them.
 *
 * @internal
 */
export type ResourceEvictor = (where: object, dispatch?: Dispatch) => void;
