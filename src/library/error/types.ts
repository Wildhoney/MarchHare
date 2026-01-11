import { ReactNode } from "react";

/**
 * Reasons why an action error occurred.
 */
export enum Reason {
  /** Action exceeded its timeout limit. */
  Timedout,
  /** Action was cancelled by a newer dispatch. */
  Supplanted,
  /** Action was blocked by the regulator's `allow` function returning `false`. */
  Disallowed,
  /** A generic error thrown in the user's action handler. */
  Errored,
  /** Action was aborted because the component unmounted. */
  Unmounted,
}

/**
 * Error thrown when an action is aborted, e.g., when a component unmounts
 * or when a newer dispatch cancels a previous run. Works across all platforms
 * including React Native where `DOMException` is unavailable.
 *
 * @example
 * ```ts
 * throw new AbortError("User cancelled the request");
 * ```
 */
export class AbortError extends Error {
  override name = "AbortError";
  constructor(message = "Aborted") {
    super(message);
  }
}

/**
 * Error thrown when an action exceeds its timeout limit.
 * Works across all platforms including React Native where `DOMException` is unavailable.
 *
 * @example
 * ```ts
 * throw new TimeoutError("Request took too long");
 * ```
 */
export class TimeoutError extends Error {
  override name = "TimeoutError";
  constructor(message = "Timeout") {
    super(message);
  }
}

/**
 * Details about an error that occurred during action execution.
 * @template E Custom error types to include in the union with Error.
 */
export type ErrorDetails<E extends Error = never> = {
  /** The reason for the error. */
  reason: Reason;
  /** The Error object that was thrown. */
  error: Error | E;
  /** The name of the action that caused the error (e.g., "Increment"). */
  action: string;
  /** Whether the error was handled locally via `Lifecycle.Error`. */
  handled: boolean;
};

/**
 * Handler function called when an action error occurs.
 * @template E Custom error types to include in the union with Error.
 * @param details Information about the error.
 */
export type ErrorHandler<E extends Error = never> = (
  details: ErrorDetails<E>,
) => void;

/**
 * Props for the Error boundary component.
 * @template E Custom error types to include in the union with Error.
 */
export type Props<E extends Error = never> = {
  /** Handler function called when an action error occurs. */
  handler: ErrorHandler<E>;
  /** Child components to wrap with error handling. */
  children?: ReactNode;
};
