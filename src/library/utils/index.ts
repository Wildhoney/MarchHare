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
};

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 * If an AbortSignal is provided, the sleep will reject with an AbortError
 * when the signal is aborted, allowing cleanup of pending operations.
 *
 * @param ms The number of milliseconds to sleep.
 * @param signal Optional AbortSignal to cancel the sleep early.
 * @returns A promise that resolves after the delay or rejects if aborted.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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
