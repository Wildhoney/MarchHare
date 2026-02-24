import { createContext, useContext } from "react";
import { Catcher, Reason } from "./types.ts";

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
    if (error.name === "DisallowedError") return Reason.Disallowed;
  }
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

/**
 * React context for handling errors that occur within actions.
 */
export const ErrorContext = createContext<Catcher | undefined>(undefined);

/**
 * Hook to access the error handler from the nearest Error provider.
 *
 * @returns The error handler function, or undefined if not within an Error provider.
 */
export function useError() {
  return useContext(ErrorContext);
}
