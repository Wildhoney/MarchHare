import type { BroadcastEmitter } from "../broadcast/utils.ts";
import type { ActionId } from "../tasks/types.ts";

/**
 * Represents a single scope in the ancestor chain. The scope key is the
 * action id of the multicast action that opens the scope; each multicast
 * action defines its own scope.
 */
export type ScopeEntry = {
  /** The action id that opened this scope */
  action: ActionId;
  /** BroadcastEmitter for multicast events within this scope (caches last payload per event) */
  emitter: BroadcastEmitter;
};

/**
 * The scope context is a flattened map of ancestor scopes keyed by the
 * multicast action that opened each scope. Each `withScope` merges its entry
 * with the parent's map, building up a complete lookup table for O(1)
 * retrieval. null indicates no scope ancestor.
 */
export type ScopeContext = Map<ActionId, ScopeEntry> | null;
