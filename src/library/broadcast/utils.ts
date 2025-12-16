import type { BroadcastContext } from "./types.ts";
import EventEmitter from "eventemitter3";
import * as React from "react";

/**
 * React context for broadcasting distributed actions across components.
 */
export const Context = React.createContext<BroadcastContext>({
  instance: new EventEmitter(),
});

/**
 * Hook to access the broadcast context for emitting and listening to distributed actions.
 *
 * @returns The broadcast context containing the EventEmitter instance.
 */
export function useBroadcast() {
  return React.useContext(Context);
}
