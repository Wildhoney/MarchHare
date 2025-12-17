import { ReactNode } from "react";

/**
 * Reasons why an action error occurred.
 */
export enum Reason {
  /** Action exceeded its timeout limit (from `@use.timeout()`). */
  Timeout = "Timeout",
  /** Action was cancelled, e.g., by `@use.exclusive()` aborting a previous run. */
  Aborted = "Aborted",
  /** An error thrown in the user's action handler. */
  Error = "Error",
}

/**
 * Details about an error that occurred during action execution.
 */
export type ErrorDetails = {
  /** The reason for the error. */
  reason: Reason;
  /** The Error object that was thrown. */
  error: Error;
  /** The name of the action that caused the error (e.g., "Increment"). */
  action: string;
};

/**
 * Handler function called when an action error occurs.
 * @param details Information about the error.
 */
export type ErrorHandler = (details: ErrorDetails) => void;

/**
 * Props for the Error boundary component.
 */
export type Props = {
  /** Handler function called when an action error occurs. */
  handler: ErrorHandler;
  /** Child components to wrap with error handling. */
  children?: ReactNode;
};
