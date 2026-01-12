import { createContext, useContext } from "react";
import { Catcher } from "./types.ts";

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
