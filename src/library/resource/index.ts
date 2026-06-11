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
      "context.actions.resource(...) and context.actions.resource.set(...) " +
        "must be called with a fresh resource invocation, e.g. " +
        "context.actions.resource(resource.cat({ id: 5 })).",
    );
  }
  const call = pending;
  pending = null;
  return call;
}

function build<T, P extends object>(
  ƒ: Fetcher<T, P>,
  backing: Cache,
): ResourceHandle<T, P> {
  const read = (params: P) => {
    const stored = backing.get<T>(key(params));
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
    ƒ(<Args<P>>{ env, controller, params, dispatch }).then((resolved) => {
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
 * directly. Exported as `shared.Resource`. Calling the returned handle
 * with `params` returns the sync cache value (`T | null`) and primes
 * the slot consumed by `context.actions.resource(...)` / `.set(...)`
 * for fetch and write paths.
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
 * Every successful fetch writes through to a per-resource in-memory
 * cache; pair with {@link Resource.Cachable} to persist across reloads.
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
 */
export function Resource<
  E extends object,
  T,
  P extends object = Record<never, never>,
>(ƒ: AppFetcher<E, T, P>): ResourceHandle<T, P> {
  const inner = <Fetcher<T, P>>(<unknown>ƒ);
  return build(inner, defaultCache(inner));
}

export namespace Resource {
  /**
   * Cache-aware variant of {@link Resource}, exported as
   * `shared.Resource.Cachable`. The supplied {@link Cache} is the
   * **second** argument (after the Env generic) &mdash; persistence is
   * the headline of this form, the fetcher is the operation. Every
   * successful fetch writes through to the cache; first reads via the
   * call form auto-seed from the cache's adapter.
   *
   * Takes the same **Env shape `E` as a mandatory first generic** as
   * {@link Resource}. For single-app resources, prefer
   * `app.Resource.Cachable(cache, fetcher)` &mdash; the Env is captured
   * from `app` automatically.
   *
   * @template E The Env shape (or union) the fetcher's `context.env` is
   *   typed against.
   * @template T The payload type the fetcher resolves to.
   * @template P The call-time params type.
   *
   * @example
   * ```ts
   * import { Cache, shared } from "march-hare";
   *
   * type WebEnv = { session: Session | null };
   *
   * const cache = Cache({
   *   get: (key) => localStorage.getItem(key),
   *   set: (key, value) => localStorage.setItem(key, value),
   *   remove: (key) => localStorage.removeItem(key),
   *   clear: () => localStorage.clear(),
   * });
   *
   * export const cat = shared.Resource.Cachable<WebEnv, Cat>(cache, async (context) =>
   *   ky
   *     .get("https://api.thecatapi.com/v1/images/search", {
   *       signal: context.controller.signal,
   *     })
   *     .json<Cat[]>()
   *     .then((cats) => cats[0]),
   * );
   * ```
   */
  export function Cachable<
    E extends object,
    T,
    P extends object = Record<never, never>,
  >(cache: Cache, ƒ: AppFetcher<E, T, P>): ResourceHandle<T, P> {
    return build(<Fetcher<T, P>>(<unknown>ƒ), cache);
  }
}
