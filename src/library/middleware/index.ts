import {
  Middleware,
  MiddlewareHandler as Handler,
  Model,
  ActionsClass,
  Status,
  meta,
} from "../types/index.ts";
import { AbortError, Reason, TimeoutError } from "../error/types.ts";
import type { Inspect } from "immertation";

export type { Middleware };

/**
 * Primitive types that can be used as reactive dependencies.
 */
export type Primitive = string | number | boolean | null | undefined | symbol;

/**
 * Context provided to reactive/poll callback functions.
 */
export type SnapshotContext<M = unknown> = {
  model: M;
  inspect: Inspect<M>;
};

/**
 * Middleware factories for adding behavior to action handlers.
 *
 * Pass middleware as additional arguments to `actions.useAction()`:
 *
 * @example
 * ```ts
 * actions.useAction(
 *   Actions.Search,
 *   (meta, query) => { ... },
 *   Use.Debounce(300),
 *   Use.Supplant(),
 * );
 * ```
 */
export const Use = {
  /**
   * Ensures only one instance of an action runs at a time.
   * When dispatched again, the previous instance is aborted via `context.signal`.
   *
   * @returns A middleware that cancels previous in-flight handlers.
   *
   * @example
   * ```ts
   * actions.useAction(
   *   Actions.Fetch,
   *   async (meta, id) => {
   *     const data = await fetch(`/api/${id}`, { signal: context.signal });
   *     // ...
   *   },
   *   Use.Supplant(),
   * );
   * ```
   */
  Supplant(): Middleware {
    const state = new Map<symbol, AbortController>();

    return {
      name: "supplant",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
        action: symbol,
      ): Handler<M, AC> => {
        return <Handler<M, AC>>(async (ctx, payload) => {
          const previous = state.get(action);
          if (previous) {
            previous.abort(Reason.Supplanted);
          }
          state.set(action, ctx[meta].controller);
          await handler(ctx, payload);
        });
      },
    };
  },

  /**
   * Delays action execution until no new dispatches occur for the specified duration.
   * Useful for search inputs, form validation, and auto-save functionality.
   *
   * @param ms The debounce delay in milliseconds.
   * @returns A middleware that debounces the handler.
   *
   * @example
   * ```ts
   * actions.useAction(
   *   Actions.Search,
   *   (meta, query) => { ... },
   *   Use.Debounce(300),
   * );
   * ```
   */
  Debounce(ms: number): Middleware {
    const state = {
      timerId: <ReturnType<typeof setTimeout> | null>null,
      pendingReject: <((reason: unknown) => void) | null>null,
    };

    return {
      name: "debounce",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
      ): Handler<M, AC> => {
        return (ctx, payload) => {
          const controller = ctx[meta].controller;

          if (state.timerId) {
            clearTimeout(state.timerId);
            if (state.pendingReject) {
              state.pendingReject(new AbortError());
              state.pendingReject = null;
            }
          }

          return new Promise((resolve, reject) => {
            state.pendingReject = reject;
            const settled = { value: false };

            const cleanup = () => {
              if (state.timerId) {
                clearTimeout(state.timerId);
                state.timerId = null;
              }
              state.pendingReject = null;
            };

            controller.signal.addEventListener(
              "abort",
              () => {
                if (settled.value) return;
                settled.value = true;
                cleanup();
                reject(new AbortError());
              },
              { once: true },
            );

            state.timerId = setTimeout(async () => {
              if (settled.value) return;
              state.timerId = null;
              state.pendingReject = null;

              if (controller.signal.aborted) {
                settled.value = true;
                reject(new AbortError());
                return;
              }

              try {
                const result = await handler(ctx, payload);
                settled.value = true;
                resolve(<void>result);
              } catch (error) {
                settled.value = true;
                reject(error);
              }
            }, ms);
          });
        };
      },
    };
  },

  /**
   * Limits action execution to at most once per specified time window.
   * The first call executes immediately, subsequent calls during the cooldown
   * are queued and the last one executes when the window expires.
   *
   * @param ms The throttle window in milliseconds.
   * @returns A middleware that throttles the handler.
   *
   * @example
   * ```ts
   * actions.useAction(
   *   Actions.Scroll,
   *   (meta, position) => { ... },
   *   Use.Throttle(100),
   * );
   * ```
   */
  Throttle(ms: number): Middleware {
    type PendingArgs<M extends Model, AC extends ActionsClass> = {
      ctx: Parameters<Handler<M, AC>>[0];
      payload: unknown;
    };

    const state = {
      lastExecution: 0,
      pendingArgs: <PendingArgs<Model, ActionsClass> | null>null,
      timerId: <ReturnType<typeof setTimeout> | null>null,
      pendingResolvers: <
        {
          resolve(value: unknown): void;
          reject(reason: unknown): void;
        }[]
      >[],
    };

    return {
      name: "throttle",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
      ): Handler<M, AC> => {
        return <Handler<M, AC>>(async (ctx, payload) => {
          const controller = ctx[meta].controller;
          const now = Date.now();
          const elapsed = now - state.lastExecution;

          if (elapsed >= ms) {
            state.lastExecution = now;
            await handler(ctx, payload);
            return;
          }

          state.pendingArgs = <PendingArgs<Model, ActionsClass>>{
            ctx,
            payload,
          };

          const abortHandler = () => {
            if (state.pendingArgs && state.pendingArgs.ctx === ctx) {
              state.pendingArgs = null;
            }
          };
          controller.signal.addEventListener("abort", abortHandler, {
            once: true,
          });

          if (!state.timerId) {
            return new Promise((resolve, reject) => {
              state.pendingResolvers.push({ resolve, reject });

              state.timerId = setTimeout(async () => {
                state.timerId = null;
                const args = state.pendingArgs;
                const resolvers = state.pendingResolvers;
                state.pendingArgs = null;
                state.pendingResolvers = [];

                if (!args || args.ctx[meta].controller.signal.aborted) {
                  resolvers.forEach((r) => r.reject(new AbortError()));
                  return;
                }

                state.lastExecution = Date.now();

                try {
                  const result = await handler(
                    <Parameters<Handler<M, AC>>[0]>args.ctx,
                    args.payload,
                  );
                  resolvers.forEach((r) => r.resolve(result));
                } catch (error) {
                  resolvers.forEach((r) => r.reject(error));
                }
              }, ms - elapsed);
            });
          }

          return new Promise((resolve, reject) => {
            state.pendingResolvers.push({ resolve, reject });
          });
        });
      },
    };
  },

  /**
   * Automatically retries failed actions with specified delay intervals.
   * Respects the abort signal and stops retrying if aborted.
   *
   * @param intervals Array of delays in milliseconds between retries.
   *                  Defaults to exponential backoff: [1s, 2s, 4s].
   * @returns A middleware that retries the handler on failure.
   *
   * @example
   * ```ts
   * // Default exponential backoff
   * actions.useAction(
   *   Actions.Fetch,
   *   async (meta, id) => { ... },
   *   Use.Retry(),
   * );
   *
   * // Custom intervals
   * actions.useAction(
   *   Actions.Fetch,
   *   async (meta, id) => { ... },
   *   Use.Retry([100, 500, 1000]),
   * );
   * ```
   */
  Retry(intervals: number[] = [1_000, 2_000, 4_000]): Middleware {
    return {
      name: "retry",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
      ): Handler<M, AC> => {
        return <Handler<M, AC>>(async (ctx, payload) => {
          const controller = ctx[meta].controller;

          const attempt = async (remaining: number[]): Promise<void> => {
            if (controller.signal.aborted) {
              throw new AbortError();
            }

            try {
              await handler(ctx, payload);
            } catch (error) {
              if (error instanceof AbortError) {
                throw error;
              }

              const [nextInterval, ...rest] = remaining;
              if (nextInterval === undefined || controller.signal.aborted) {
                throw error;
              }

              await new Promise<void>((resolve, reject) => {
                const timerId = setTimeout(resolve, nextInterval);
                controller.signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timerId);
                    reject(new AbortError());
                  },
                  { once: true },
                );
              });

              await attempt(rest);
            }
          };

          await attempt(intervals);
        });
      },
    };
  },

  /**
   * Aborts the action if it exceeds the specified duration.
   * Triggers the abort signal, allowing the action to clean up gracefully.
   *
   * @param ms The timeout duration in milliseconds.
   * @returns A middleware that times out the handler.
   *
   * @example
   * ```ts
   * actions.useAction(
   *   Actions.Fetch,
   *   async (meta, id) => { ... },
   *   Use.Timeout(5000),
   * );
   * ```
   */
  Timeout(ms: number): Middleware {
    return {
      name: "timeout",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
      ): Handler<M, AC> => {
        return <Handler<M, AC>>(async (ctx, payload) => {
          const state = { timer: <ReturnType<typeof setTimeout> | null>null };

          try {
            await Promise.race([
              handler(ctx, payload),
              new Promise<never>((_, reject) => {
                state.timer = setTimeout(() => {
                  ctx[meta].controller.abort(new TimeoutError());
                  reject(new TimeoutError());
                }, ms);
              }),
            ]);
          } finally {
            if (state.timer) clearTimeout(state.timer);
          }
        });
      },
    };
  },

  /**
   * Automatically triggers an action when its primitive dependencies change.
   *
   * Dependencies are primitives compared using checksum for change detection.
   * When dependencies change, the action is dispatched with the payload (if provided).
   *
   * @param getDependencies Function returning primitive array for change detection.
   * @param getPayload Optional function returning the payload when triggered.
   * @returns A middleware that registers reactive behavior.
   *
   * @example
   * ```ts
   * actions.useAction(
   *   Actions.Search,
   *   (meta, query) => { ... },
   *   Use.Reactive(
   *     (ctx) => [ctx.model.searchTerm],
   *     (ctx) => ctx.model.searchTerm,
   *   ),
   * );
   * ```
   */
  Reactive<M = unknown, P = unknown>(
    getDependencies: (context: SnapshotContext<M>) => Primitive[],
    getPayload?: (context: SnapshotContext<M>) => P,
  ): Middleware & { reactive: object } {
    return {
      name: "reactive",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
      ): Handler<M, AC> => handler,
      reactive: {
        getDependencies,
        getPayload,
      },
    };
  },

  /**
   * Automatically triggers an action at regular intervals.
   *
   * @param interval The polling interval in milliseconds.
   * @param getPayload Optional function returning the payload when triggered.
   * @param getStatus Optional function returning Status.Play or Status.Pause.
   * @returns A middleware that registers polling behavior.
   *
   * @example
   * ```ts
   * actions.useAction(
   *   Actions.Refresh,
   *   (context) => { ... },
   *   Use.Poll(5000),
   * );
   *
   * // With payload and pause control
   * actions.useAction(
   *   Actions.Refresh,
   *   (meta, userId) => { ... },
   *   Use.Poll(
   *     5000,
   *     (ctx) => ctx.model.userId,
   *     (ctx) => ctx.model.isPaused ? Status.Pause : Status.Play,
   *   ),
   * );
   * ```
   */
  Poll<M = unknown, P = unknown>(
    interval: number,
    getPayload?: (context: SnapshotContext<M>) => P,
    getStatus: (context: SnapshotContext<M>) => Status = () => Status.Play,
  ): Middleware & { poll: object } {
    return {
      name: "poll",
      wrap: <M extends Model, AC extends ActionsClass>(
        handler: Handler<M, AC>,
      ): Handler<M, AC> => handler,
      poll: {
        interval,
        getPayload,
        getStatus,
      },
    };
  },
};
