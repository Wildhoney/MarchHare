import { Pk } from "../types/index.ts";
import { AbortError } from "../error/types.ts";
import { empty, present, unset } from "./utils.ts";
import type { Adapter, Encoded, Store, Stored } from "./types.ts";

export { unset } from "./utils.ts";
export type { Adapter, Encoded, Store, Stored, Unset } from "./types.ts";

/**
 * Returns a promise that resolves after the specified number of
 * milliseconds, or rejects with an {@link AbortError} when the signal is
 * aborted. Use to inject a cancellable delay into an action handler.
 *
 * @param ms How long to wait before resolving.
 * @param signal Optional {@link AbortSignal} that cancels the sleep early.
 *               Pass `context.task.controller.signal` to tie the wait to
 *               the lifetime of the current action.
 * @returns A promise that resolves after `ms` milliseconds or rejects with
 *          an {@link AbortError} if `signal` aborts first.
 */
export function sleep(
  ms: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new AbortError());
      },
      { once: true },
    );
  });
}

/**
 * Repeatedly calls a function at a fixed interval until it returns `true`
 * or the signal is aborted. The function is invoked immediately on the
 * first iteration, then after each interval.
 *
 * @param ms Interval in milliseconds between invocations of `fn`.
 * @param signal Optional {@link AbortSignal} that cancels polling early.
 *               Aborts propagate as an {@link AbortError} rejection.
 * @param fn Predicate invoked each iteration. Return `true` to stop
 *           polling, `false` to schedule another invocation after `ms`.
 *           May be sync or async.
 * @returns A promise that resolves when `fn` returns `true`, or rejects
 *          with an {@link AbortError} if `signal` aborts first.
 */
export async function poll(
  ms: number,
  signal: AbortSignal | undefined,
  fn: () => boolean | Promise<boolean>,
): Promise<void> {
  if (signal?.aborted) throw new AbortError();

  while (true) {
    const done = await fn();
    if (done) return;
    await sleep(ms, signal);
  }
}

/**
 * Generates a unique primary key.
 *
 * @returns A new unique symbol representing the primary key.
 */
export function pk(): symbol;
/**
 * Checks if the provided ID is a valid primary key. A valid primary key
 * is any value that is not a symbol.
 *
 * @template T The model type the key identifies.
 * @param id The primary key to validate.
 * @returns `true` if `id` is a non-symbol value, `false` otherwise.
 */
export function pk<T>(id: Pk<T>): boolean;
export function pk<T>(id?: Pk<T>): boolean | symbol {
  if (id) return Boolean(id && typeof id !== "symbol");
  return Symbol(`pk.${Date.now()}.${crypto.randomUUID()}`);
}

/**
 * Wraps a synchronous {@link Adapter} into a {@link Store} that traffics
 * in {@link Stored} values. Storage entries serialise as
 * {@link Encoded}`<T>` so the `Temporal.Instant` timestamp survives the
 * string round-trip and `BoundResourceHandle.if({ over })` can
 * short-circuit on the persisted timestamp after a reload.
 *
 * @param adapter Backend implementation providing raw string `get`/`set`/
 *                `remove`/`clear`. The Store layers JSON encoding and
 *                timestamp serialisation on top.
 * @returns A {@link Store} bound to `adapter`. Reads return {@link Stored}
 *          envelopes; writes accept Stored envelopes and return `true`
 *          when the entry landed in the adapter.
 *
 * @example
 * ```ts
 * const store = utils.store({
 *   get: (key) => localStorage.getItem(key),
 *   set: (key, value) => localStorage.setItem(key, value),
 *   remove: (key) => localStorage.removeItem(key),
 *   clear: () => localStorage.clear(),
 * });
 *
 * // Read into a Resource fallback chain.
 * { cat: get.cat.else(store.get(Snapshots.Cat)).else(null) }
 *
 * // Write the latest cached value back to storage.
 * store.set(Snapshots.Cat, get.cat.snapshot());
 *
 * // Drop a snapshot on sign-out, cache invalidation, etc.
 * store.remove(Snapshots.Cat);
 *
 * // Or wipe the whole backing store (scope is the adapter's call).
 * store.clear();
 * ```
 */
export function store(adapter: Adapter): Store {
  return {
    get<T>(key: string): Stored<T> {
      try {
        const raw = adapter.get(key);
        if (raw === null) return empty<T>();
        const parsed = <Encoded<T>>JSON.parse(raw);
        return present(parsed.data, Temporal.Instant.from(parsed.at));
      } catch {
        return empty<T>();
      }
    },
    set<T>(key: string, value: Stored<T>): boolean {
      if (value.data === unset || value.at === null) return false;
      try {
        adapter.set(
          key,
          JSON.stringify(<Encoded<T>>{
            data: value.data,
            at: value.at.toString(),
          }),
        );
        return true;
      } catch {
        return false;
      }
    },
    remove(key: string): void {
      adapter.remove(key);
    },
    clear(): void {
      adapter.clear();
    },
  };
}

/** Shorthand alias for {@link sleep}. */
export const ζ = sleep;

/** Shorthand alias for {@link poll}. */
export const π = poll;

/** Shorthand alias for {@link pk}. */
export const κ = pk;

/** Shorthand alias for {@link store}. */
export const σ = store;
