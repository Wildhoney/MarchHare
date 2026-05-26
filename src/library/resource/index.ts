import type { Args, Fetcher } from "./types.ts";
import { Cache, defaultCache, key } from "./utils.ts";
import { present, unset } from "../utils/utils.ts";
import type { Store } from "../boundary/components/store/index.tsx";

export type { Fetcher } from "./types.ts";

/**
 * Snapshot of the most recent resource invocation. `cat(params)` writes
 * one of these into a module-scope slot; the next
 * `context.actions.resource(...)` / `.set(...)` call consumes it via
 * {@link consumePending}.
 *
 * @internal
 */
export type PendingCall = {
  readonly run: (
    store: Store,
    controller: AbortController,
    params: object,
  ) => Promise<unknown>;
  readonly read: (params: object) => {
    data: unknown;
    at: Temporal.Instant | null;
  };
  readonly seed: (params: object, data: unknown, at: Temporal.Instant) => void;
  readonly params: object;
};

let pending: PendingCall | null = null;

/**
 * Reads and clears the slot populated by the most recent resource
 * invocation. Throws when the slot is empty &mdash; the public
 * `.resource(...)` shape requires a fresh `cat(params)` call as its
 * argument.
 *
 * @internal
 */
export function consumePending(): PendingCall {
  if (pending === null) {
    throw new Error(
      "context.actions.resource(...) and context.actions.resource.set(...) " +
        "must be called with a fresh resource invocation, e.g. " +
        "context.actions.resource(cat({ id: 5 })).",
    );
  }
  const call = pending;
  pending = null;
  return call;
}

/**
 * Resource handle returned by `Resource(...)`. Call it with `params` to
 * read the per-params cache slot synchronously and prime the slot
 * consumed by `context.actions.resource(...)` for a follow-up fetch or
 * `context.actions.resource.set(...)` for an out-of-band write.
 *
 * ```ts
 * // Sync cache read in a model literal.
 * { cat: cat({ id: 5 }) }
 *
 * // Fetch with `.exceeds(...)` for cache-aware refresh.
 * await context.actions.resource(cat({ id: 5 })).exceeds({ minutes: 5 });
 *
 * // Write through to the per-params cache slot.
 * context.actions.resource.set(cat({ id: 5 }), data);
 * ```
 */
export type Resource<T, P extends object = Record<never, never>> = [
  keyof P,
] extends [never]
  ? (params?: P) => T | null
  : (params: P) => T | null;

/**
 * Defines a remote resource &mdash; declared at module scope and used
 * directly. Calling the returned handle with `params` returns the sync
 * cache value (`T | null`) and primes the slot consumed by
 * `context.actions.resource(...)` / `.set(...)` for fetch and write
 * paths.
 *
 * The fetcher receives a single args object `{ store, controller, params }`:
 *
 * - `store` &ndash; snapshot of the per-`<Boundary>` Store (session,
 *   locale, feature flags, etc.). Reads only; writes go through
 *   `context.actions.produce(({ store }) => ...)` in handlers.
 * - `controller` &ndash; the `AbortController` auto-threaded from the
 *   calling handler's `context.task.controller`. Pass `controller.signal`
 *   to `fetch`/`ky`, or call `controller.abort()` to fail fast.
 * - `params` &ndash; the call-site params object (defaults to `{}`).
 *
 * Resources do **not** carry any callbacks &ndash; side-effects
 * (broadcasting, logging, model updates) belong in the `useAction`
 * handler that awaited `context.actions.resource(...)`.
 *
 * Every successful fetch writes through to the per-fetcher {@link Cache}
 * (in-memory by default, persistent when an adapter is supplied via the
 * second argument).
 *
 * @example
 * ```ts
 * import { Resource, Cache } from "march-hare";
 *
 * export const user = Resource<User, { id: number }>(
 *   ({ store, controller, params }) =>
 *     ky.get(`users/${params.id}`, {
 *       headers: store.session
 *         ? { Authorization: `Bearer ${store.session.accessToken}` }
 *         : {},
 *       signal: controller.signal,
 *     }).json<User>(),
 * );
 *
 * // Sync cache read at module scope or in the model literal.
 * const cached: User | null = user({ id: 5 });
 *
 * // Fetch inside a handler — controller and Store auto-threaded.
 * actions.useAction(Actions.Mount, async (context) => {
 *   const data = await context.actions
 *     .resource(user({ id: 5 }))
 *     .exceeds({ minutes: 5 });
 *   context.actions.produce(({ model }) => void (model.user = data));
 * });
 * ```
 */
export function Resource<T, P extends object = Record<never, never>>(
  fetcher: Fetcher<T, P>,
  cache?: Cache,
): Resource<T, P> {
  const backing = cache ?? defaultCache(fetcher);

  const read = (params: P) => {
    const stored = backing.get<T>(key(params));
    if (stored.data === unset || stored.at === null) {
      return { data: unset, at: null };
    }
    return { data: <T>stored.data, at: stored.at };
  };

  const run = (
    store: Store,
    controller: AbortController,
    params: P,
  ): Promise<T> =>
    fetcher(<Args<P>>{ store, controller, params }).then((resolved) => {
      backing.set(key(params), present(resolved, Temporal.Now.instant()));
      return resolved;
    });

  const seed = (params: P, data: T, at: Temporal.Instant): void => {
    backing.set(key(params), present(data, at));
  };

  function call(params?: P): T | null {
    const effective = <P>(params ?? {});
    pending = {
      run: <PendingCall["run"]>run,
      read: <PendingCall["read"]>read,
      seed: <PendingCall["seed"]>seed,
      params: effective,
    };
    queueMicrotask(() => {
      if (pending !== null && pending.params === effective) pending = null;
    });
    const { data } = read(effective);
    return data === unset ? null : <T>data;
  }

  return <Resource<T, P>>call;
}
