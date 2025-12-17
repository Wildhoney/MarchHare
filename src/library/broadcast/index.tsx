import { Props } from "./types.ts";
import { Context } from "./utils.ts";
import EventEmitter from "eventemitter3";
import * as React from "react";

export { useBroadcast } from "./utils.ts";

/**
 * Creates a new broadcast context for distributed actions. Only needed if you
 * want to isolate a broadcast context, useful for libraries that want to provide
 * their own broadcast context without interfering with the app's broadcast context.
 *
 * @param props.children - The children to render within the broadcast context.
 * @returns The children wrapped in a broadcast context provider.
 */
export function Broadcaster({ children }: Props): React.ReactNode {
  const context = React.useMemo(() => new EventEmitter(), []);

  return <Context.Provider value={context}>{children}</Context.Provider>;
}
