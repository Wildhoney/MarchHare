import type { ConsumerContext } from "./types.ts";
import * as React from "react";

/**
 * React context for the consumer store.
 * Stores the latest value for each distributed action with full annotation support.
 */
export const Context = React.createContext<ConsumerContext>(new Map());

/**
 * Hook to access the consumer store from context.
 *
 * @returns The Map of action symbols to their State entries.
 */
export function useConsumer(): ConsumerContext {
  return React.useContext(Context);
}
