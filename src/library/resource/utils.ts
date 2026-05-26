import { Cache } from "../cache/index.ts";
import { unset } from "../utils/index.ts";

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
  let cache = defaults.get(fetcher);
  if (cache === undefined) {
    cache = Cache();
    defaults.set(fetcher, cache);
  }
  return cache;
}

/**
 * Stable string key derived from the call-site `params`. Two calls with
 * the same logical params (same key order, same primitive values) hit
 * the same slot. JSON.stringify is sufficient for the Chizu params
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
