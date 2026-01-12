import {
  Actions,
  ReactiveInterface,
  Model,
  Payload,
  Pk,
} from "../types/index.ts";
import { AbortError, Reason } from "../error/types.ts";

/**
 * Configuration constants for Chizu action symbols.
 */
export const config = {
  /** Prefix for all Chizu action symbols. */
  actionPrefix: "chizu.action/",
  /** Prefix for distributed (broadcast) action symbols. */
  distributedActionPrefix: "chizu.action/distributed/",
};

/**
 * Determines the error reason based on what was thrown.
 *
 * @param error - The value that was thrown.
 * @returns The appropriate Reason enum value.
 */
export function getReason(error: unknown): Reason {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return Reason.Timedout;
    if (error.name === "AbortError") return Reason.Supplanted;
  }
  return Reason.Errored;
}

/**
 * Normalises a thrown value into an Error instance.
 *
 * @param error - The value that was thrown.
 * @returns An Error instance (original if already Error, wrapped otherwise).
 */
export function normaliseError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

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

/**
 * Creates a generic "setter" action that updates a specific property in the state.
 * This is a higher-order function that takes a property name and returns an action function.
 * The returned action, when called, will update the state with the provided payload for the specified property.
 * It uses `produce` to handle immutable state updates.
 *
 * @template M The model (state) type.
 * @template A The actions type.
 * @param property The name of the property in the state to update.
 * @returns An action function that takes the context and a payload, and updates the state.
 */
export function set<M extends Model, AC extends Actions>(property: string) {
  return (context: ReactiveInterface<M, AC>, payload: Payload): void => {
    context.actions.produce(({ model }) => {
      (<Record<string, Payload>>model)[property] = payload;
    });
  };
}

/** Shorthand alias for {@link set}. */
export const λ = set;
