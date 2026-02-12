import EventEmitter from "eventemitter3";
import * as React from "react";

/**
 * EventEmitter subclass that caches the latest payload per event.
 *
 * When a broadcast or multicast action is dispatched, the payload is
 * stored so that late-mounting components can replay it via
 * {@link useLifecycles} and handlers can read it via
 * `context.actions.read()`.
 */
export class BroadcastEmitter extends EventEmitter {
  private cache = new Map<string | symbol, unknown>();

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    this.cache.set(event, args[0]);
    return super.emit(event, ...args);
  }

  /**
   * Retrieve the last emitted payload for a given event.
   */
  getCached(event: string | symbol): unknown {
    return this.cache.get(event);
  }
}

/**
 * React context for broadcasting distributed actions across components.
 */
export const Context = React.createContext<BroadcastEmitter>(
  new BroadcastEmitter(),
);

/**
 * Hook to access the broadcast EventEmitter for emitting and listening to distributed actions.
 *
 * @returns The BroadcastEmitter instance for distributed actions.
 */
export function useBroadcast(): BroadcastEmitter {
  return React.useContext(Context);
}
