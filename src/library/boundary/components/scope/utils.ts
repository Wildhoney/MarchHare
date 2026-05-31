import type { ScopeContext, ScopeEntry } from "./types.ts";
import * as React from "react";

/**
 * React context for the nearest multicast scope. `null` at the root.
 *
 * @internal
 */
export const Context = React.createContext<ScopeContext>(null);

/**
 * Hook that returns the nearest multicast scope entry. `null` when
 * the caller is not rendered inside any `<app.Scope().Boundary>`.
 *
 * @internal
 */
export function useScope(): ScopeContext {
  return React.useContext(Context);
}

/**
 * Pass-through accessor. Kept for the dispatch/subscribe sites that
 * previously needed an action-keyed lookup; now the scope is a single
 * entry (or `null`), so this returns it as-is.
 *
 * @internal
 */
export function getScope(context: ScopeContext): ScopeEntry | null {
  return context;
}
