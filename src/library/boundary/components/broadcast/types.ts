import EventEmitter from "eventemitter3";
import * as React from "react";

/**
 * The broadcast context is an EventEmitter used for distributed actions across components.
 */
export type BroadcastContext = EventEmitter;

/**
 * Return type for the useBroadcast hook.
 * Provides access to the shared EventEmitter for emitting and subscribing to distributed actions.
 */
export type UseBroadcast = BroadcastContext;

/**
 * Props for the Broadcaster provider component.
 */
export type Props = {
  children: React.ReactNode;
};
