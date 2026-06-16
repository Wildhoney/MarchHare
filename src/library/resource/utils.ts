import { Cache } from "../cache/index.ts";
import { present, unset } from "../utils/utils.ts";
import type { Env } from "../boundary/components/env/types.ts";
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
 * Re-export of the shared `unset` sentinel from {@link "../utils/index.ts"}.
 *
 * @internal
 */
export const config = <const>{
  unset,
};

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
 * @internal
 */
export function build<T, P extends object>(
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
    ƒ(<Args<P>>{ env, controller, params, dispatch }).then((resolved) => {
      backing.set(cacheKey(params), present(resolved, Temporal.Now.instant()));
      return resolved;
    });

  const evict = (where: object): void => {
    const entries = Object.entries(where);
    for (const k of [...backing.keys()]) {
      if (!k.startsWith(prefix)) continue;
      try {
        const parsed = <Record<string, unknown>>(
          JSON.parse(k.slice(prefix.length))
        );
        if (entries.every(([key, v]) => parsed[key] === v)) backing.remove(k);
      } catch {
        continue;
      }
    }
  };

  evictors.push(evict);

  function call(params?: P): Invocation<T, P> {
    const effective = <P>(params ?? {});
    return <Invocation<T, P>>{
      run,
      read,
      evict,
      params: effective,
    };
  }

  function get(params?: P): T | null {
    const { data } = read(<P>(params ?? {}));
    return data === unset ? null : <T>data;
  }

  Object.defineProperty(call, "get", { value: get, enumerable: false });

  return <ResourceHandle<T, P>>(<unknown>call);
}
