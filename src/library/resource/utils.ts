import { Cache } from "../cache/index.ts";
import { present, unset } from "../utils/utils.ts";
import type { Env } from "../boundary/components/env/types.ts";
import { Action } from "../action/index.ts";
import { Distribution, type Filter } from "../types/index.ts";
import type {
  Args,
  Dispatch,
  Fetcher,
  Invocation,
  ResourceEvictor,
  ResourceHandle,
} from "./types.ts";
import { G } from "@mobily/ts-belt";

export { Cache } from "../cache/index.ts";

/**
 * Default in-memory `Cache` used when {@link Resource} is constructed
 * without an explicit one. Each fetcher gets its own slot via the
 * outer `WeakMap` so unrelated Resources don't share a string-key
 * namespace.
 *
 * @internal
 */
export const defaults = new WeakMap<object, Cache>();

/**
 * Returns the {@link Cache} bound to `fetcher`, allocating a fresh
 * in-memory Cache on first access.
 *
 * @internal
 */
export function defaultCache(fetcher: object): Cache {
  const existing = defaults.get(fetcher);
  if (G.isNotNullable(existing)) return existing;
  const cache = Cache();
  defaults.set(fetcher, cache);
  return cache;
}

/**
 * Stable string key derived from the call-site `params`. Two calls with
 * the same logical params (same key order, same primitive values) hit
 * the same slot. JSON.stringify is sufficient for the March Hare params
 * convention (primitive-leaf objects); callers who need order-stable
 * keying should normalise the object before passing it in.
 *
 * @internal
 */
export function key(params: object): string {
  return JSON.stringify(params);
}

/**
 * Per-fetcher namespace registry. Each declared Resource takes a stable
 * id derived from the order of insertion (`namespaces.size`), used to
 * prefix cache keys when an App-shared {@link Cache} is configured.
 *
 * @internal
 */
const namespaces = new Map<object, string>();

/**
 * Per-Resource eviction callbacks. Each `Resource` declaration registers
 * one entry on construction; the public `nuke(...)` (defined in
 * {@link "./index.ts"}) iterates them to drop cache slots across every
 * Resource in the process.
 *
 * @internal
 */
export const evictors: Array<ResourceEvictor> = [];

/**
 * Mints the next namespace id for an app-shared cache. Each `app.Resource`
 * declaration consumes one id so the shared {@link Cache} can keep
 * resource-specific slots from colliding on shared params keys.
 *
 * @internal
 */
export function nextResourceId(fetcher: object): string {
  const existing = namespaces.get(fetcher);
  if (G.isNotNullable(existing)) return existing;
  const namespace = String(namespaces.size);
  namespaces.set(fetcher, namespace);
  return namespace;
}

/**
 * Allocates the per-Resource closure shared by `app.Resource` and
 * `shared.Resource`. The returned callable produces an
 * {@link Invocation} on every call &mdash; pass it to
 * `context.actions.resource(...)` for fetch/evict. `.get(params)` reads
 * the per-params cache slot synchronously.
 *
 * `getEnv` is the App-supplied accessor used to resolve the live env at
 * sync read time (`.get(params)`) and at App-side eviction (when the
 * handler context isn't available). It returns `undefined` when no
 * Boundary has mounted yet &mdash; in which case `cache.scope(undefined)`
 * yields the empty prefix and the read/evict targets the unscoped slot.
 *
 * @internal
 */
export function build<T, P extends object>(
  ƒ: Fetcher<T, P>,
  backing: Cache,
  namespace: string | null,
  getEnv: () => Env | undefined,
): ResourceHandle<T, P> {
  const suffix = G.isNull(namespace) ? "" : `${namespace}:`;
  const composeKey = (env: Env | undefined, params: P) => {
    const scope = backing.scope(env);
    const prefix = scope === "" ? "" : `${scope}:`;
    return `${prefix}${suffix}${key(params)}`;
  };

  const action = Action<T | null, Filter>(
    `resource:${ƒ.name || "anonymous"}`,
    Distribution.Broadcast,
  );

  const read = (params: P, env: Env | undefined) => {
    const stored = backing.get<T>(composeKey(env, params));
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
      backing.set(
        composeKey(env, params),
        present(resolved, Temporal.Now.instant()),
      );
      void dispatch(action(<Filter>(<unknown>params)), resolved);
      return resolved;
    });

  function actionFn(channel?: Partial<P> & Filter) {
    return action(<Filter>(channel ?? {}));
  }

  const evict = (where: object, dispatch?: Dispatch): void => {
    const env = getEnv();
    const scope = backing.scope(env);
    const fullPrefix = scope === "" ? suffix : `${scope}:${suffix}`;
    const entries = Object.entries(where);
    const evicted: Array<Filter> = [];
    for (const cacheKey of [...backing.keys()]) {
      if (!cacheKey.startsWith(fullPrefix)) continue;
      try {
        const parsed = <Record<string, unknown>>(
          JSON.parse(cacheKey.slice(fullPrefix.length))
        );
        if (entries.every(([field, value]) => parsed[field] === value)) {
          backing.remove(cacheKey);
          evicted.push(<Filter>parsed);
        }
      } catch {
        continue;
      }
    }
    if (G.isNotNullable(dispatch)) {
      for (const channel of evicted) {
        void dispatch(action(channel), null);
      }
    }
  };

  evictors.push(evict);

  function call(params?: P): Invocation<T, P> {
    const effective = <P>(params ?? {});
    return <Invocation<T, P>>{
      run,
      read: (params: P) => read(params, getEnv()),
      evict,
      params: effective,
    };
  }

  function get(params?: P): T | null {
    const { data } = read(<P>(params ?? {}), getEnv());
    return data === unset ? null : <T>data;
  }

  Object.defineProperty(call, "get", { value: get, enumerable: false });
  Object.defineProperty(call, "action", { value: actionFn, enumerable: false });

  return <ResourceHandle<T, P>>(<unknown>call);
}
