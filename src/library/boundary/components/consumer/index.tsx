import { Props, ConsumerContext } from "./types.ts";
import { Context } from "./utils.ts";
import * as React from "react";

export { useConsumer } from "./utils.ts";
export { Partition } from "./components/partition/index.tsx";
export type { Props as PartitionProps } from "./components/partition/types.ts";
export type { ConsumerRenderer, Entry, ConsumerContext } from "./types.ts";

/**
 * Creates a new consumer context for storing distributed action values. Only needed if you
 * want to isolate a consumer context, useful for libraries that want to provide
 * their own consumer context without interfering with the app's consumer context.
 *
 * The Consumer stores the latest value for each distributed action, allowing components
 * that mount later to access values that were dispatched before they mounted. This enables
 * the `consume()` method to render the most recent value immediately.
 *
 * @param props.children - The children to render within the consumer context.
 * @returns The children wrapped in a consumer context provider.
 */
export function Consumer({ children }: Props): React.ReactNode {
  const store = React.useMemo<ConsumerContext>(() => new Map(), []);

  return <Context.Provider value={store}>{children}</Context.Provider>;
}
