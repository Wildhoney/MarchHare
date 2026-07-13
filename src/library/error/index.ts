export { Reason } from "./types";
export type { Fault } from "./types";

/**
 * Error thrown when an action is aborted, e.g., when a component unmounts
 * or when a newer dispatch cancels a previous run. Works across all platforms
 * including React Native where `DOMException` is unavailable.
 *
 * The instance's `name` field stays as `"AbortError"` so it can be
 * pattern-matched alongside native `DOMException`s and ky/fetch aborts.
 *
 * @example
 * ```ts
 * throw new Aborted("User cancelled the request");
 * ```
 */
export class Aborted extends Error {
  override name = "AbortError";
  constructor(message = "Aborted") {
    super(message);
  }
}

/**
 * Error raised when an omnicast payload fails its action's schema
 * validation &mdash; on the dispatching side before anything reaches the
 * wire, or on the receiving side when a peer's envelope does not parse.
 * Faults carrying this error report `Reason.Rejected`, and the underlying
 * validator error (e.g. the `ZodError`) is preserved on `cause`.
 *
 * @example
 * ```ts
 * actions.useAction(Actions.Error, (context, fault) => {
 *   if (fault.reason === Reason.Rejected) {
 *     console.error(fault.error.cause);
 *   }
 * });
 * ```
 */
export class Rejected extends Error {
  override name = "RejectError";
  constructor(message = "Rejected", options?: { cause?: unknown }) {
    super(message, options);
  }
}
