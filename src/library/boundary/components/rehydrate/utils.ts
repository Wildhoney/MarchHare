import type { Rehydrator } from "./types.ts";
import * as React from "react";

/**
 * React context for the shared rehydrator.
 */
export const Context = React.createContext<Rehydrator>({
  data: new Map(),
});

/**
 * Hook to access the rehydrator from context.
 *
 * @returns The rehydrator from the current context.
 */
export function useRehydrator(): Rehydrator {
  return React.useContext(Context);
}
