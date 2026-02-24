import { Pk } from "../types/index.ts";
import { AbortError } from "../error/types.ts";

/**
 * Configuration constants for Chizu action symbols.
 */
export const config = {
  /** Prefix for all Chizu action symbols. */
  actionPrefix: "chizu.action/",
  /** Prefix for broadcast action symbols. */
  broadcastActionPrefix: "chizu.action/broadcast/",
  /** Prefix for multicast action symbols. */
  multicastActionPrefix: "chizu.action/multicast/",
  /** Prefix for channeled action symbols. */
  channelPrefix: "chizu.channel/",
  /** Prefix for cache operation symbols. */
  cachePrefix: "chizu.cache/",
  /** Prefix for lifecycle action symbols. */
  lifecyclePrefix: "chizu.action.lifecycle/",
};

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
