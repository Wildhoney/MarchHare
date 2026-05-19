import { Pk } from "../types/index.ts";
import { AbortError } from "../error/types.ts";

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 * The sleep will reject with an AbortError when the signal is aborted,
 * allowing cleanup of pending operations.
 *
 * @param ms The number of milliseconds to sleep.
 * @param signal AbortSignal to cancel the sleep early.
 * @returns A promise that resolves after the delay or rejects if aborted.
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

/** Shorthand alias for {@link sleep}. */
export const ζ = sleep;

/**
 * Repeatedly calls a function at a fixed interval until it returns `true` or
 * the signal is aborted. The function is invoked immediately on the first
 * iteration, then after each interval.
 *
 * @param ms The interval in milliseconds between invocations.
 * @param signal Optional AbortSignal to cancel polling early.
 * @param fn Callback invoked each iteration. Return `true` to stop polling.
 * @returns A promise that resolves when `fn` returns `true`, or rejects with
 *          an AbortError if the signal is aborted.
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

/** Shorthand alias for {@link poll}. */
export const π = poll;

/**
 * Generates a unique primary key.
 * @returns A new unique symbol representing the primary key.
 */
export function pk(): symbol;
/**
 * Checks if the provided ID is a valid primary key.
 * A valid primary key is considered any value that is not a symbol.
 * @template T The type of the object.
 * @param id The primary key to validate.
 * @returns `true` if the ID is valid, `false` otherwise.
 */
export function pk<T>(id: Pk<T>): boolean;
export function pk<T>(id?: Pk<T>): boolean | symbol {
  if (id) return Boolean(id && typeof id !== "symbol");
  return Symbol(`pk.${Date.now()}.${crypto.randomUUID()}`);
}

/** Shorthand alias for {@link pk}. */
export const κ = pk;

/**
 * Sentinel symbol marking "no value present yet". Shared by the Resource
 * cache and by storage handles so callers can distinguish "nothing has been
 * recorded" from "a legitimately stored null".
 */
export const unset: unique symbol = Symbol("march-hare.unset");

/** Nominal type of the {@link unset} sentinel. */
export type Unset = typeof unset;

/**
 * Common shape for a possibly-present value with a timestamp. Produced by
 * `BoundResourceHandle.snapshot()` (from the in-memory cache) and by
 * `Store.get(key)` (from persistent storage). Both feed into the bound
 * handle's overloaded `.else(...)`, which seeds the cache when given a
 * Stored that carries data and a timestamp.
 */
export type Stored<T> = {
  /** The payload, or {@link unset} when nothing is recorded. */
  readonly data: T | Unset;
  /** When the payload was recorded, or `null` when nothing is recorded. */
  readonly at: Temporal.Instant | null;
  /**
   * Returns {@link data} when present, otherwise the supplied fallback.
   * Symmetric with `BoundResourceHandle.else(...)`'s terminal form.
   */
  readonly else: <U>(fallback: U) => T | U;
};

/**
 * Constructs a Stored<T> in the empty state. Internal helper shared by
 * the storage layer and the Resource snapshot accessor.
 * @internal
 */
export function empty<T>(): Stored<T> {
  return {
    data: unset,
    at: null,
    else: <U>(fallback: U): T | U => fallback,
  };
}

/**
 * Constructs a Stored<T> wrapping a present payload and timestamp.
 * @internal
 */
export function present<T>(data: T, at: Temporal.Instant): Stored<T> {
  return {
    data,
    at,
    else: <U>(_fallback: U): T | U => data,
  };
}

/**
 * Adapter contract for synchronous key/value storage. Implement once per
 * backend (localStorage, MMKV on React Native, chrome.storage with a sync
 * facade, etc.) and pass to {@link store}. The adapter shuttles raw strings;
 * JSON encoding and `Temporal.Instant` round-tripping happen inside the
 * Store wrapper, so adapters stay trivial.
 */
export type Adapter = {
  readonly get: (key: string) => string | null;
  readonly set: (key: string, value: string) => void;
  readonly remove: (key: string) => void;
};

/**
 * Bound storage instance returned by {@link store}. Reads return a
 * {@link Stored} handle so the result composes with the Resource bound
 * handle's `.else(...)`; writes accept a Stored and short-circuit on the
 * empty case to avoid persisting placeholder snapshots.
 */
export type Store = {
  readonly get: <T>(key: string) => Stored<T>;
  readonly set: <T>(key: string, value: Stored<T>) => void;
  readonly remove: (key: string) => void;
};

/**
 * Wraps a synchronous {@link Adapter} into a {@link Store} that traffics in
 * {@link Stored} values. Storage entries serialise as
 * `{ data, at: Temporal.Instant.toString() }` so timestamps survive
 * round-trip and `BoundResourceHandle.if({ over })` can short-circuit on
 * the persisted timestamp after a reload.
 *
 * @example
 * ```ts
 * const store = utils.store({
 *   get: (key) => localStorage.getItem(key),
 *   set: (key, value) => localStorage.setItem(key, value),
 *   remove: (key) => localStorage.removeItem(key),
 * });
 *
 * // Read into a Resource fallback chain.
 * { cat: get.cat.else(store.get(Snapshots.Cat)).else(null) }
 *
 * // Write the latest cached value back to storage.
 * store.set(Snapshots.Cat, get.cat.snapshot());
 * ```
 */
export function store(adapter: Adapter): Store {
  return {
    get<T>(key: string): Stored<T> {
      try {
        const raw = adapter.get(key);
        if (raw === null) return empty<T>();
        const parsed = <{ data: T; at: string }>JSON.parse(raw);
        return present(parsed.data, Temporal.Instant.from(parsed.at));
      } catch {
        // Malformed JSON, missing fields, or unparseable timestamp — treat
        // as if the entry isn't there so the consumer falls through to its
        // next fallback rather than crashing on render.
        return empty<T>();
      }
    },
    set<T>(key: string, value: Stored<T>): void {
      if (value.data === unset || value.at === null) return;
      try {
        adapter.set(
          key,
          JSON.stringify({
            data: value.data,
            at: value.at.toString(),
          }),
        );
      } catch {
        // Adapter threw — quota, private mode, sandboxed iframe. Swallow
        // so a write failure can't poison an already-resolved fetch.
      }
    },
    remove(key: string): void {
      adapter.remove(key);
    },
  };
}
