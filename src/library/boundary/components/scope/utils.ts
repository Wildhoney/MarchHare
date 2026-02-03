import type { ScopeContext, ScopeEntry } from "./types.ts";
import * as React from "react";

/**
 * React context for the scope chain.
 * Starts as null (no scopes).
 */
export const Context = React.createContext<ScopeContext>(null);

/**
 * Hook to access the scope context from the nearest ancestor.
 *
 * @returns The scope context chain, or null if not inside any scope.
 */
export function useScope(): ScopeContext {
  return React.useContext(Context);
}

/**
 * Gets the scope with the given name.
 * O(1) lookup from the flattened scope map.
 *
 * @param context - The current scope context (map of all ancestor scopes)
 * @param name - The scope name to find
 * @returns The matching ScopeEntry, or null if not found
 */
export function getScope(
  context: ScopeContext,
  name: string,
): ScopeEntry | null {
  return context?.get(name) ?? null;
}
