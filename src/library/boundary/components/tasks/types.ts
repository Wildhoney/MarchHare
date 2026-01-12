import * as React from "react";

/**
 * An action identifier - either a symbol (preferred) or string.
 */
export type ActionId = symbol | string;

/**
 * Represents a running task with its associated metadata.
 * Tasks are stored in a Set ordered by creation time (oldest first).
 *
 * @template P - The payload type for this task
 * @property task - The AbortController to cancel this task
 * @property action - The action identifier that triggered this task
 * @property payload - The payload passed when the action was dispatched
 *
 * @example
 * ```ts
 * // Abort all tasks for a specific action
 * for (const runningTask of context.tasks) {
 *   if (runningTask.action === Actions.Fetch) {
 *     runningTask.task.abort();
 *   }
 * }
 *
 * // Abort the oldest task
 * const oldest = context.tasks.values().next().value;
 * oldest?.task.abort();
 * ```
 */
export type Task<P = unknown> = {
  task: AbortController;
  action: ActionId;
  payload: P;
};

/**
 * A set of running tasks ordered by creation time (oldest first).
 */
export type Tasks = Set<Task>;

/**
 * Props for the Tasks provider component.
 */
export type Props = {
  children: React.ReactNode;
};
