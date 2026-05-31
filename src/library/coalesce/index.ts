import type { Coalesce } from "../resource/types.ts";

/**
 * Sentinel token used when `.coalesce()` is called with no explicit
 * argument. Every untokened caller for the same `(Resource, params)`
 * slot collapses onto this single key, so multiple callers chaining
 * `.coalesce()` share one in-flight fetch.
 *
 * The symbol description follows the `march-hare.{category}/{name}`
 * convention used by the rest of the library's internal symbols.
 *
 * @internal
 */
export const token: unique symbol = Symbol("march-hare.coalesce/default");

/**
 * Builds the per-call dedupe key for `.coalesce(token)`.
 *
 * The full registry key (constructed at the call site) is
 * `${JSON.stringify(params)}|${coalesceKey(token)}`; this function is
 * responsible only for the trailing token segment. Every supported
 * `Coalesce` primitive (`string`, `number`, `bigint`, `boolean`,
 * `symbol`) is prefixed with a single-character type tag so that
 * structurally identical values from different types stay distinct
 * &mdash; e.g. the string `"5"` does not collide with the number `5`,
 * and `Symbol("X")` does not collide with the string `"X"`.
 *
 * Symbols are keyed by their `description` (falling back to
 * `String(value)` for description-less symbols) so two `Symbol("X")`
 * instances declared in separate modules still hash to the same key.
 * That is intentional: the public contract is "same description &rarr;
 * same coalesce group", which keeps the API friendly for the common
 * enum-token pattern at call sites.
 *
 * Any unrecognised value falls through to the object branch and is
 * keyed by its JSON shape; `Coalesce` is constrained to primitives at
 * the type level, so this branch is reachable only from `unknown`
 * coercion in tests.
 *
 * @internal
 */
export function coalesceKey(value: Coalesce): string {
  switch (typeof value) {
    case "string":
      return `s:${value}`;
    case "number":
      return `n:${value}`;
    case "bigint":
      return `i:${value.toString()}`;
    case "boolean":
      return `b:${value}`;
    case "symbol":
      return `y:${value.description ?? String(value)}`;
    default:
      return `o:${JSON.stringify(value)}`;
  }
}

/**
 * Wraps `promise` so that aborting `signal` rejects the returned
 * promise with `signal.reason`, even when `promise` itself never
 * settles. The original promise is left alone &mdash; the underlying
 * work continues (other awaiters keep their grip) and only this
 * caller's view of it is severed.
 *
 * Used by the `.coalesce(token)` chainable: the shared in-flight fetch
 * runs on a detached `AbortController` so one caller's abort does not
 * cancel work the others are still waiting on, while each caller's own
 * `context.task.controller` still aborts its personal await via this
 * wrapper. The `{ once: true }` listener and the cleanup on settle keep
 * the wrapper free of leaks across long-lived signals.
 *
 * @internal
 */
export function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
