import type {
  Args,
  Dispatch,
  Fetcher,
  PendingCall,
  ResourceHandle,
} from "./types.ts";
import { Cache, defaultCache, key } from "./utils.ts";
import { present, unset } from "../utils/utils.ts";
import type { Env } from "../boundary/components/env/index.tsx";
import type { AppFetcher } from "../app/types.ts";
import { G } from "@mobily/ts-belt";

export type {
  Coalesce,
  Fetcher,
  PendingCall,
  ResourceHandle,
} from "./types.ts";

let pending: PendingCall | null = null;
let nextResourceId = 0;

type ResourceEvictor = (where: object) => Promise<void>;

const evictors: Array<ResourceEvictor> = [];

/**
 * Reads and clears the slot populated by the most recent resource
 * invocation. Throws when the slot is empty &mdash; the public
 * `.resource(...)` shape requires a fresh `resource.cat(params)` call
 * as its argument.
 *
 * @internal
 */
export function consumePending(): PendingCall {
  if (G.isNull(pending)) {
    throw new Error(
      "context.actions.resource(...) must be called with a fresh resource " +
        "invocation, e.g. context.actions.resource(resource.cat({ id: 5 })).",
    );
  }
  const call = pending;
  pending = null;
  return call;
}

/**
 * Evicts cache entries across every Resource constructed in the
 * current process. Resources register themselves on declaration, so
 * `nuke` covers both `app.Resource` and `shared.Resource`. Pass a
 * `where` pattern to drop only slots whose stored params satisfy the
 * pattern's keys (partial match &mdash; extra keys in the stored
 * params are ignored). Pass nothing to clear every known slot.
 *
 * @internal Public surface lives on `context.actions.resource.nuke(...)`.
 */
export function nuke(where?: object): Promise<void> {
  const pattern = where ?? {};
  return Promise.all(evictors.map((evict) => evict(pattern))).then(() => {});
}

function build<T, P extends object>(
  ƒ: Fetcher<T, P>,
  backing: Cache,
  namespace: string | null,
): ResourceHandle<T, P> {
  const prefix = G.isNull(namespace) ? "" : `${namespace}:`;
  const cacheKey = (params: P) => `${prefix}${key(params)}`;

  const read = (params: P) => {
    const stored = backing.get<T>(cacheKey(params));
    if (stored.data === unset || G.isNull(stored.at)) {
      return { data: unset, at: null };
    }
    return { data: <T>stored.data, at: stored.at };
  };

  const run = (
    env: Env,
    controller: AbortController,
    params: P,
    dispatch: Dispatch,
  ): Promise<T> =>
    ƒ(<Args<P>>{ env, controller, params, dispatch }).then((resolved) =>
      backing
        .set(cacheKey(params), present(resolved, Temporal.Now.instant()))
        .then(() => resolved),
    );

  const evict = (where: object): Promise<void> => {
    const entries = Object.entries(where);
    return backing.keys().then((stored) => {
      const removals: Array<Promise<void>> = [];
      for (const k of [...stored]) {
        if (!k.startsWith(prefix)) continue;
        try {
          const parsed = <Record<string, unknown>>(
            JSON.parse(k.slice(prefix.length))
          );
          if (entries.every(([key, v]) => parsed[key] === v))
            removals.push(backing.remove(k));
        } catch {
          // skip malformed entries
        }
      }
      return Promise.all(removals).then(() => {});
    });
  };

  evictors.push(evict);

  function call(params?: P): T | null {
    const effective = <P>(params ?? {});
    pending = {
      run: <PendingCall["run"]>run,
      read: <PendingCall["read"]>read,
      evict,
      params: effective,
    };
    queueMicrotask(() => {
      if (G.isNotNullable(pending) && pending.params === effective)
        pending = null;
    });
    const { data } = read(effective);
    return data === unset ? null : <T>data;
  }

  return <ResourceHandle<T, P>>call;
}

/**
 * Defines a remote resource &mdash; declared at module scope and used
 * directly. Exported as `shared.Resource` and (via the app factory) as
 * `app.Resource`. Calling the returned handle with `params` returns the
 * sync cache value (`T | null`) and primes the slot consumed by
 * `context.actions.resource(...)` for fetch or
 * `context.actions.resource(...).evict(where?)` for partial-match
 * invalidation. Persistence happens automatically when the App is
 * declared with `App({ cache })`.
 *
 * Takes the **Env shape `E` as a mandatory first generic** &mdash;
 * `context.env` inside the fetcher is typed as `E`. Pass a union of
 * every App's Env if the resource is shared across reusable
 * components. For single-app resources, prefer `app.Resource` &mdash;
 * the Env is captured from `app` automatically and you only need the
 * payload generic.
 *
 * The fetcher receives a single `context` argument carrying `env`,
 * `controller`, `params`, and a broadcast/multicast-only `dispatch`.
 * `env` is a live handle &mdash; dot reads inside the fetcher always
 * see the latest per-`<Boundary>` Env, even after `await` boundaries.
 *
 * Cache behaviour is decided at the App level: when `App({ cache })`
 * is supplied, every `app.Resource` declaration on that App writes
 * through to (and seeds from) the shared cache, isolated per resource
 * by a stable module-order namespace. When the App is constructed
 * without a `cache`, every resource keeps its own in-memory slot.
 * Standalone `shared.Resource` declarations always use an in-memory
 * cache &mdash; reach for `app.Resource` when persistence is required.
 *
 * Concurrent calls fire fresh requests by default. Opt in to in-flight
 * sharing per call via `.coalesce(key)` on the thenable returned from
 * `context.actions.resource(...)`.
 *
 * @template E The Env shape (or union) the fetcher's `context.env` is
 *   typed against.
 * @template T The payload type the fetcher resolves to.
 * @template P The call-time params type.
 *
 * @example
 * ```ts
 * import { shared } from "march-hare";
 *
 * type WebEnv = { session: Session | null };
 *
 * export const user = shared.Resource<WebEnv, User, { id: number }>((context) =>
 *   ky
 *     .get(`users/${context.params.id}`, {
 *       headers: context.env.session
 *         ? { Authorization: `Bearer ${context.env.session.accessToken}` }
 *         : {},
 *       signal: context.controller.signal,
 *     })
 *     .json<User>(),
 * );
 * ```
 *
 * @internal The optional `cache` argument is reserved for `app.Resource`
 *   &mdash; consumers should use `App({ cache })` instead of passing it
 *   directly.
 */
export function Resource<
  E extends object,
  T,
  P extends object = Record<never, never>,
>(ƒ: AppFetcher<E, T, P>, cache?: Cache): ResourceHandle<T, P> {
  const inner = <Fetcher<T, P>>(<unknown>ƒ);
  if (G.isUndefined(cache)) {
    return build(inner, defaultCache(inner), null);
  }
  return build(inner, cache, String(nextResourceId++));
}
