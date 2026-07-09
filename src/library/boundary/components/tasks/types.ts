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
  readonly controller: AbortController;
  readonly action: ActionId;
  readonly payload: P;
};

/**
 * A set of running tasks ordered by creation time (oldest first).
 */
export type Tasks = Set<Task>;

/**
 * The handler's own task, exposed as `context.task`. A {@link Task} plus
 * {@link CurrentTask.supersede} &mdash; only the current task carries the
 * method; the {@link Tasks} set holds plain {@link Task} records.
 */
export type CurrentTask<P = unknown> = Task<P> & {
  /**
   * Abort every other in-flight task dispatched from the same action,
   * leaving this one running &mdash; the one-line form of the debounce
   * sibling-abort loop. Superseded tasks reject with `Reason.Aborted`.
   *
   * @example
   * ```ts
   * actions.useAction(Actions.Search, async (context, query) => {
   *   context.task.supersede();
   *   await utils.sleep(300, context.task.controller.signal);
   *   // ...only the last dispatch in a burst reaches here
   * });
   * ```
   */
  supersede(): void;
};

/**
 * Props for the Tasks provider component.
 */
export type Props = {
  children: React.ReactNode;
};
