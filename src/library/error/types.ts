import type { Task } from "../boundary/components/tasks/types.ts";

/**
 * Reasons why an action error occurred.
 */
export enum Reason {
  /** Action was aborted &mdash; superseded by a newer dispatch, the
   *  component unmounted, or `task.controller.abort()` was called. */
  Aborted,
  /** A generic error thrown in the user's action handler. */
  Errored,
}

/**
 * Error thrown when an action is aborted, e.g., when a component unmounts
 * or when a newer dispatch cancels a previous run. Works across all platforms
 * including React Native where `DOMException` is unavailable.
 *
 * The instance's `name` field stays as `"AbortError"` so it can be
 * pattern-matched alongside native `DOMException`s and ky/fetch aborts.
 *
 * @example
 * ```ts
 * throw new Aborted("User cancelled the request");
 * ```
 */
export class Aborted extends Error {
  override name = "AbortError";
  constructor(message = "Aborted") {
    super(message);
  }
}

/**
 * Details about an error that occurred during action execution.
 *
 * Faults are delivered through the global `Lifecycle.Fault` broadcast.
 * Subscribe with `actions.useAction(Lifecycle.Fault, handler)` near the
 * root of your application for app-level concerns (logging, sign-out on
 * auth failure, abort cascades). For component-local recovery, use a
 * `Lifecycle.Error()` factory instead.
 *
 * @template E Custom error types to include in the union with Error.
 */
export type Fault<E extends Error = never> = {
  /** The reason for the error. */
  reason: Reason;
  /** The Error object that was thrown. */
  error: Error | E;
  /** The name of the action that caused the error (e.g., "Increment"). */
  action: string;
  /** Whether the component has a `Lifecycle.Error()` handler registered. */
  handled: boolean;
  /**
   * All currently running tasks across the application.
   * Use this to programmatically abort in-flight actions during error recovery
   * (e.g., on 403/500 responses to prevent cascading failures).
   *
   * @example
   * ```ts
   * actions.useAction(Lifecycle.Fault, (context, fault) => {
   *   if (fault.reason === Reason.Errored) {
   *     for (const task of fault.tasks) task.controller.abort();
   *   }
   * });
   * ```
   */
  tasks: ReadonlySet<Task>;
  /**
   * Re-dispatches the failed action with the original payload and channel,
   * routed through the same emitter (broadcast, multicast, or unicast) as the
   * original dispatch. Resolves when every triggered handler has settled.
   *
   * `retry` is independent of the failed task's `AbortController`: even when
   * the failure was an `Aborted` reason, calling `retry()` fires a fresh
   * dispatch with a new task. The closure stays callable after the fault
   * handler returns, which makes it safe to surface from a UI &mdash; e.g. a
   * "Retry" button bound to `fault.retry`.
   *
   * @example
   * ```ts
   * actions.useAction(Lifecycle.Fault, (_context, fault) => {
   *   if (fault.reason === Reason.Errored && isTransient(fault.error)) {
   *     void fault.retry();
   *   }
   * });
   * ```
   */
  retry: () => Promise<void>;
};
