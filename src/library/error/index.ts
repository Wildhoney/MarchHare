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
