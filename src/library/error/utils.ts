import { Reason } from "./types.ts";

/**
 * Determines the error reason based on what was thrown.
 *
 * @param error - The value that was thrown.
 * @returns The appropriate Reason enum value.
 */
export function getReason(error: unknown): Reason {
  const isAborted = error instanceof Error && error.name === "AbortError";
  return isAborted ? Reason.Aborted : Reason.Errored;
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
