import type { BroadcastEmitter } from "./utils.ts";
import * as React from "react";

/**
 * The broadcast context is a BroadcastEmitter used for distributed actions across components.
 * Extends EventEmitter with a per-action value cache so late-mounting components can replay
 * broadcast values even without a Partition (from `stream()`).
 */
export type BroadcastContext = BroadcastEmitter;

/**
 * Return type for the useBroadcast hook.
 * Provides access to the shared BroadcastEmitter for emitting and subscribing to distributed actions.
 */
export type UseBroadcast = BroadcastContext;

/**
 * Props for the Broadcaster provider component.
 */
export type Props = {
  children: React.ReactNode;
};
