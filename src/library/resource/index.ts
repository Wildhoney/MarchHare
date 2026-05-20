import * as React from "react";
import type {
  IfOptions,
  ResourceFetcher,
  ResourceHandle,
  BoundResourceHandle,
} from "./types.ts";
import { cache } from "./utils.ts";
import { empty, present, unset } from "../utils/utils.ts";
import type { Stored } from "../utils/types.ts";

export type {
  IfOptions,
  ResourceFetcher,
  ResourceHandle,
  BoundResourceHandle,
} from "./types.ts";

/**
 * Defines a remote resource &mdash; declared at module scope and
 * consumed via {@link useResource}.
 *
 * The fetcher receives the optional `AbortSignal` first and the
 * `params` object second (defaults to `{}`). Resources do **not**
 * carry any callbacks &ndash; side-effects (broadcasting, logging,
 * model updates) belong in the `useAction` handler that called
 * `await handle(...)`.
 *
 * Every call fires its own request. The most recent successful
 * payload is cached in a module-level `WeakMap` keyed by the fetcher,
 * so `.if(...)` and `.else(...)` on the bound handle behave
 * consistently across all components that share the same Resource.
 *
 * @example
 * ```ts
 * import { Resource } from "march-hare";
 *
 * // `T` is inferred from the fetcher's return type.
 * export const user = Resource((signal) =>
 *   ky.get("user", { signal }).json<User>(),
 * );
 *
 * // Annotate `params` when destructuring so `P` is inferred.
 * export const updateUser = Resource(
 *   (signal, { id, body }: { id: number; body: { name: string } }) =>
 *     ky.patch(`users/${id}`, { json: body, signal }).json<User>(),
 * );
 * ```
 */
export function Resource<T, P extends object = Record<never, never>>(
  fetcher: ResourceFetcher<T, P>,
): ResourceHandle<T, P> {
  const run = (signal: AbortSignal | undefined, params: P): Promise<T> =>
    fetcher(signal, params).then((resolved) => {
      cache.set(fetcher, { data: resolved, at: Temporal.Now.instant() });
      return resolved;
    });

  return {
    run,
    get data() {
      const entry = cache.get(fetcher);
      return entry === undefined ? unset : <T>entry.data;
    },
    get at() {
      return cache.get(fetcher)?.at ?? null;
    },
    seed(data, at) {
      cache.set(fetcher, { data, at });
    },
  };
}

/**
 * Type-guard recognising the {@link Stored} structural shape on the
 * fallback argument to `.else(...)`. Matches anything that exposes
 * `data`, `at`, and `else` properties &mdash; including the bound handle
 * itself, which is a deliberate no-op (seeding from cache into cache).
 */
function isStored<T>(value: unknown): value is Stored<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    "data" in value &&
    "at" in value &&
    "else" in value
  );
}

/**
 * Binds a module-scope {@link ResourceHandle} to the component, returning
 * the fetch callable with `.if`, `.else`, `.snapshot`, `.data`, and `.at`
 * attached. The hook is standalone &ndash; call it *before* `useActions`
 * when you want to seed the initial model from the cache via
 * `.else(fallback)`.
 *
 * Pass `context.task.controller.signal` as the first argument to thread
 * cancellation from the surrounding action handler through to the
 * fetcher. For parameterised resources, pass `null` as the first arg
 * when you have params but no signal.
 *
 * @example
 * ```ts
 * const cat = useResource(resources.cat);
 * const actions = useActions<Model, typeof Actions, Data>(
 *   { cat: cat.else(store.get(Snapshots.Cat)).else(null) },
 *   () => ({ index, router }),
 * );
 *
 * actions.useAction(Actions.Mount, async (context) => {
 *   const fresh = await cat.if(
 *     { over: { minutes: 5 } },
 *     context.task.controller.signal,
 *   );
 *   store.set(Snapshots.Cat, cat.snapshot());
 *   context.actions.produce(({ model }) => void (model.cat = fresh));
 * });
 * ```
 */
export function useResource<T, P extends object>(
  resource: ResourceHandle<T, P>,
): BoundResourceHandle<T, P> {
  return React.useMemo(() => {
    const call = (signal?: AbortSignal | null, params?: P): Promise<T> =>
      resource.run(signal ?? undefined, <P>(params ?? {}));

    const ifOver = (
      options: IfOptions,
      signal?: AbortSignal | null,
      params?: P,
    ): Promise<T> => {
      const data = resource.data;
      const at = resource.at;
      if (data !== unset && at !== null) {
        const elapsed = Temporal.Now.instant().since(at);
        const window = Temporal.Duration.from(options.over);
        if (Temporal.Duration.compare(elapsed, window) <= 0) {
          return Promise.resolve(data);
        }
      }
      return resource.run(signal ?? undefined, <P>(params ?? {}));
    };

    const snapshot = (): Stored<T> => {
      const data = resource.data;
      const at = resource.at;
      if (data === unset || at === null) return empty<T>();
      return present(data, at);
    };

    function elseFallback(stored: Stored<T>): BoundResourceHandle<T, P>;
    function elseFallback<U>(fallback: U): T | U;
    function elseFallback<U>(
      fallback: U | Stored<T>,
    ): (T | U) | BoundResourceHandle<T, P> {
      if (isStored<T>(fallback)) {
        if (
          resource.data === unset &&
          fallback.data !== unset &&
          fallback.at !== null
        ) {
          resource.seed(fallback.data, fallback.at);
        }
        return <BoundResourceHandle<T, P>>(<unknown>call);
      }
      const data = resource.data;
      return data === unset ? fallback : data;
    }

    Object.defineProperties(call, {
      if: { value: ifOver, enumerable: true },
      else: { value: elseFallback, enumerable: true },
      snapshot: { value: snapshot, enumerable: true },
      data: { get: () => resource.data, enumerable: true },
      at: { get: () => resource.at, enumerable: true },
    });

    return <BoundResourceHandle<T, P>>(<unknown>call);
  }, [resource]);
}
