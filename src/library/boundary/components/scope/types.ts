import type EventEmitter from "eventemitter3";
import type { Entry } from "../consumer/types.ts";
import type { ActionId } from "../tasks/types.ts";
import type * as React from "react";

/**
 * Props for the Scope component.
 */
export type Props = {
  /** The unique name for this scope. Used when dispatching multicast actions. */
  name: string;
  /** Children to render within the scope boundary. */
  children: React.ReactNode;
};

/**
 * Represents a single scope in the ancestor chain.
 * Each scope has its own EventEmitter and consumer store.
 */
export type ScopeEntry = {
  /** The name of this scope */
  name: string;
  /** EventEmitter for multicast events within this scope */
  emitter: EventEmitter;
  /** Consumer store for late-mounting components (like Broadcast) */
  store: Map<ActionId, Entry>;
  /** Listeners for store changes (for consume() re-renders) */
  listeners: Map<ActionId, Set<() => void>>;
};

/**
 * The scope context is a flattened map of all ancestor scopes by name.
 * Each <Scope> merges its entry with the parent's map, building up a
 * complete lookup table for O(1) retrieval.
 * null indicates no scope ancestor.
 */
export type ScopeContext = Map<string, ScopeEntry> | null;
