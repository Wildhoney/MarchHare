import { Reason } from "./types.ts";

/**
 * Determines the error reason based on what was thrown.
 *
 * @param error - The value that was thrown.
 * @returns The appropriate Reason enum value.
 */
export function getReason(error: unknown): Reason {
  if (error instanceof Error && error.name === "AbortError")
    return Reason.Aborted;
  if (error instanceof Error && error.name === "RejectError")
    return Reason.Rejected;
  return Reason.Errored;
}

/**
 * Gets an Error instance from a thrown value.
 *
 * @param error - The value that was thrown.
 * @returns An Error instance (original if already Error, wrapped otherwise).
 */
export function getError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
