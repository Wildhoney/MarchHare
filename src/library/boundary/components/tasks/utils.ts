import { Task } from "./types.ts";
import * as React from "react";

/**
 * React context for the shared tasks Set.
 * Tasks are ordered by creation time (oldest first) since Sets maintain insertion order.
 */
export const Context = React.createContext<Set<Task>>(new Set());

/**
 * Hook to access the shared tasks Set from context.
 * Returns the Set of all currently running tasks across all components in the context.
 *
 * @returns The Set of Task instances in the current context.
 *
 * @example
 * ```ts
 * const tasks = useTasks();
 *
 * // Abort all tasks for a specific action
 * for (const task of tasks) {
 *   if (task.action === Actions.Fetch) {
 *     task.controller.abort();
 *   }
 * }
 * ```
 */
export function useTasks(): Set<Task> {
  return React.useContext(Context);
}
