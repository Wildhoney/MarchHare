import { Context } from "./utils.ts";
import { Props, Task } from "./types.ts";
import * as React from "react";

export type { Task } from "./types.ts";

/**
 * Creates a new tasks context for action control. Only needed if you
 * want to isolate a tasks context, useful for libraries that want to provide
 * their own tasks context without interfering with the app's tasks context.
 *
 * Tasks added within this context are isolated from tasks in other contexts.
 *
 * @param props.children - The children to render within the tasks context.
 * @returns The children wrapped in a tasks context provider.
 */
export function Tasks({ children }: Props): React.ReactNode {
  const tasks = React.useMemo<Set<Task>>(() => new Set(), []);

  return <Context.Provider value={tasks}>{children}</Context.Provider>;
}
