import type { BroadcastContext } from "./types.ts";
import EventEmitter from "eventemitter3";
import * as React from "react";

/**
 * React context for broadcasting distributed actions across components.
 */
export const Context = React.createContext<BroadcastContext>(
  new EventEmitter(),
);

/**
 * Hook to access the broadcast EventEmitter for emitting and listening to distributed actions.
 *
 * @returns The EventEmitter instance for distributed actions.
 */
export function useBroadcast() {
  return React.useContext(Context);
}
