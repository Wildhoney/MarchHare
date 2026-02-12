import type { BroadcastEmitter } from "../broadcast/utils.ts";
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
 * Each scope has its own BroadcastEmitter for multicast events and caching.
 */
export type ScopeEntry = {
  /** The name of this scope */
  name: string;
  /** BroadcastEmitter for multicast events within this scope (caches last payload per event) */
  emitter: BroadcastEmitter;
};

/**
 * The scope context is a flattened map of all ancestor scopes by name.
 * Each <Scope> merges its entry with the parent's map, building up a
 * complete lookup table for O(1) retrieval.
 * null indicates no scope ancestor.
 */
export type ScopeContext = Map<string, ScopeEntry> | null;
