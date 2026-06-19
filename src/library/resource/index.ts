import type { Fetcher, ResourceHandle } from "./types.ts";
import {
  Cache,
  build,
  defaultCache,
  evictors,
  nextResourceId,
} from "./utils.ts";
import type { AppFetcher } from "../app/types.ts";
import type { Env } from "../boundary/components/env/types.ts";
import { G } from "@mobily/ts-belt";

export type { Fetcher, Invocation, ResourceHandle } from "./types.ts";

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
export function nuke(where?: object): void {
  const pattern = where ?? {};
  for (const evict of evictors) evict(pattern);
}

/**
 * Defines a remote resource &mdash; declared at module scope and used
 * directly. Exported as `shared.Resource` and (via the app factory) as
 * `app.Resource`. Calling the returned handle with `params` produces an
 * {@link Invocation} suitable for `context.actions.resource(...)` (fetch
 * path) or `context.actions.resource(...).evict(where?)` (partial-match
 * invalidation). Use `.get(params)` on the handle for a synchronous
 * cache read returning `T | null`. Persistence happens automatically
 * when the App is declared with `App({ cache })`.
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
 * Concurrent calls with the same `(Resource, params)` share a single
 * in-flight fetch by default &mdash; one network request, every caller
 * resolves with the same payload. The underlying work is refcounted: if
 * every caller aborts, the shared `AbortController` is aborted too.
 * Chain `.isolated()` on the thenable returned from
 * `context.actions.resource(...)` to opt out (own controller, own
 * request) for the rare cases that need it.
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
>(
  ƒ: AppFetcher<E, T, P>,
  cache?: Cache,
  getEnv?: () => Env | undefined,
): ResourceHandle<T, P> {
  const inner = <Fetcher<T, P>>(<unknown>ƒ);
  const resolveEnv = getEnv ?? (() => undefined);
  if (G.isUndefined(cache)) {
    return build(inner, defaultCache(inner), null, resolveEnv);
  }
  return build(inner, cache, nextResourceId(inner), resolveEnv);
}
