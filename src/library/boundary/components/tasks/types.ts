import * as React from "react";

/**
 * An action identifier - either a symbol (including branded HandlerPayload) or string.
 */
export type ActionId = symbol | string;

/**
 * Represents a running task with its associated metadata.
 * Tasks are stored in a Set ordered by creation time (oldest first).
 *
 * @template P - The payload type for this task
 * @property controller - The AbortController to cancel this task
 * @property action - The action identifier that triggered this task
 * @property payload - The payload passed when the action was dispatched
 *
 * @example
 * ```ts
 * // Abort all tasks for a specific action
 * for (const runningTask of context.tasks) {
 *   if (runningTask.action === Actions.Fetch) {
 *     runningTask.controller.abort();
 *   }
 * }
 *
 * // Abort the oldest task
 * const oldest = context.tasks.values().next().value;
 * oldest?.controller.abort();
 * ```
 */
export type Task<P = unknown> = {
  controller: AbortController;
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
