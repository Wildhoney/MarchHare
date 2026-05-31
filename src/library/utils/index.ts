import { Pk } from "../types/index.ts";
import { Aborted } from "../error/types.ts";

export { unset } from "./utils.ts";
export type { Stored, Unset } from "./types.ts";

/**
 * Returns a promise that resolves after the specified number of
 * milliseconds, or rejects with an {@link Aborted} when the signal is aborted. Use to inject a cancellable
 * delay into an action handler.
 *
 * @param ms How long to wait before resolving.
 * @param signal Optional {@link AbortSignal} that cancels the sleep early.
 *               Pass `context.task.controller.signal` to tie the wait to
 *               the lifetime of the current action.
 * @returns A promise that resolves after `ms` milliseconds or rejects with
 *          an {@link Aborted} if `signal` aborts first.
 */
export function sleep(
  ms: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Aborted());
      return;
    }

    const timer = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Aborted());
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
 *               Aborts propagate as an {@link Aborted} rejection.
 * @param fn Predicate invoked each iteration. Return `true` to stop
 *           polling, `false` to schedule another invocation after `ms`.
 *           May be sync or async.
 * @returns A promise that resolves when `fn` returns `true`, or rejects
 *          with a `DOMException("aborted", "Aborted")` if `signal`
 *          aborts first.
 */
export async function poll(
  ms: number,
  signal: AbortSignal | undefined,
  fn: () => boolean | Promise<boolean>,
): Promise<void> {
  if (signal?.aborted) throw new Aborted();

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

/** Shorthand alias for {@link sleep}. */
export const ζ = sleep;

/** Shorthand alias for {@link poll}. */
export const π = poll;

/** Shorthand alias for {@link pk}. */
export const κ = pk;
