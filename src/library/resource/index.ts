import type { FetcherArgs, ResourceFetcher, ResourceHandle } from "./types.ts";
import { Cache, defaultCache, key } from "./utils.ts";
import { present, unset } from "../utils/utils.ts";
import type { Store } from "../boundary/components/store/index.tsx";

export type { FetcherArgs, ResourceFetcher, ResourceHandle } from "./types.ts";

/**
 * Defines a remote resource &mdash; declared at module scope and used
 * directly via `.get(params)` (sync cache read) or via
 * `context.actions.resource(resource, params?, over?)` from an action
 * handler (fetch, with auto-threaded abort signal and Store snapshot).
 *
 * The fetcher receives a single args object `{ store, signal, params }`:
 *
 * - `store` &ndash; snapshot of the per-`<Boundary>` Store (session,
 *   locale, feature flags, etc.). Reads only; writes go through
 *   `context.actions.produce(({ store }) => ...)` in handlers.
 * - `signal` &ndash; the `AbortSignal` auto-threaded from the calling
 *   handler's `context.task.controller.signal`.
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
 * // In-memory cache (default).
 * export const user = Resource(({ store, signal, params }: FetcherArgs<{ id: number }>) =>
 *   ky.get(`users/${params.id}`, {
 *     headers: store.session
 *       ? { Authorization: `Bearer ${store.session.accessToken}` }
 *       : {},
 *     signal,
 *   }).json<User>(),
 * );
 *
 * // Sync cache read at module scope or in the model literal.
 * const cached: User | null = user.get({ id: 5 });
 *
 * // Fetch inside a handler — signal and Store auto-threaded.
 * actions.useAction(Actions.Mount, async (context) => {
 *   const data = await context.actions.resource(user, { id: 5 }, { minutes: 5 });
 *   context.actions.produce(({ model }) => void (model.user = data));
 * });
 * ```
 */
export function Resource<T, P extends object = Record<never, never>>(
  fetcher: ResourceFetcher<T, P>,
  cache?: Cache,
): ResourceHandle<T, P> {
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
    signal: AbortSignal | undefined,
    params: P,
  ): Promise<T> =>
    fetcher(<FetcherArgs<P>>{ store, signal, params }).then((resolved) => {
      backing.set(key(params), present(resolved, Temporal.Now.instant()));
      return resolved;
    });

  return <ResourceHandle<T, P>>{
    get(params?: P) {
      const { data } = read(<P>(params ?? {}));
      return data === unset ? null : <T>data;
    },
    run,
    read,
    seed(params, data, at) {
      backing.set(key(params), present(data, at));
    },
  };
}
