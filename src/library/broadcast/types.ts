import EventEmitter from "eventemitter3";
import * as React from "react";

/**
 * The broadcast context is an EventEmitter used for distributed actions across components.
 */
export type BroadcastContext = EventEmitter;

export type UseBroadcast = BroadcastContext;

export type Props = {
  children: React.ReactNode;
};
