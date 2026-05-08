import type { ScopeContext, ScopeEntry } from "./types.ts";
import type { ActionId } from "../tasks/types.ts";
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
 * Looks up the scope opened by the given multicast action.
 * O(1) lookup from the flattened scope map.
 */
export function getScope(
  context: ScopeContext,
  action: ActionId,
): ScopeEntry | null {
  return context?.get(action) ?? null;
}
