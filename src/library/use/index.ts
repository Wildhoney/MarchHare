import { Args, Field, Instance, Method, Primitive } from "./types.ts";
import { Payload } from "../types/index.ts";
import { actionName, context, internals, entries } from "./utils.ts";
import { AbortError, TimeoutError } from "../error/types.ts";

export { context, entries } from "./utils.ts";

/**
 * Action decorators for adding common functionality to action handlers.
 */
export const use = {
  /**
   * Ensures only one instance of an action runs at a time. When dispatched again,
   * the previous instance is aborted via `context.signal`.
   *
   * @returns A decorator function for the action.
   */
  supplant() {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];

        self[field.name] = async (args: Args) => {
          internals.get(self)?.controller.abort();
          internals.set(self, args[context]);
          return await ƒ.call(self, args);
        };
      });
    };
  },
  /**
   * Automatically triggers an action when its primitive dependencies change.
   *
   * Dependencies are primitives compared using checksum for change detection.
   * When dependencies change, the action is dispatched with the payload (if provided).
   *
   * **Features:**
   * - **Primitive dependencies**: Use primitives for reliable change detection
   * - **Separate concerns**: Dependencies trigger the action, payload provides data
   * - **Type-safe payload**: TypeScript enforces `getPayload` returns the correct type
   * - **Null-safe**: Skips execution if checksum fails
   *
   * Combine with `@use.supplant()` if you want new triggers to cancel in-flight requests.
   *
   * @template P The payload type, inferred from the action.
   * @param action The action to trigger. Must match the decorated property.
   * @param getDependencies Function returning primitive array. Called every render for change detection.
   * @param getPayload Function returning the payload. Called at dispatch time. Only for actions with payloads.
   * @returns A decorator function for the action.
   *
   * @example
   * ```ts
   * // Action without payload - just dependencies for triggering
   * @use.reactive(Actions.Refresh, () => [userId, filters.length])
   * [Actions.Refresh] = refreshAction;
   * ```
   *
   * @example
   * ```ts
   * // Action with payload - dependencies trigger, getPayload provides fresh data
   * @use.reactive(
   *   Actions.FetchUser,
   *   () => [userId],
   *   () => ({ userId, includeDetails: true })
   * )
   * [Actions.FetchUser] = fetchUserAction;
   * ```
   */
  reactive<P>(
    action: Payload<P>,
    getDependencies: () => Primitive[],
    ...args: [P] extends [never] ? [] : [getPayload: () => NoInfer<P>]
  ) {
    const [getPayload] = args;

    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const set = entries.get(self) ?? new Set();

        set.add({
          action,
          getDependencies,
          getPayload,
        });

        entries.set(self, set);
      });
    };
  },
  /**
   * Logs detailed timing and debugging information for the action, including
   * start time, produce call timings, and total duration.
   *
   * @returns A decorator function for the action.
   */
  debug() {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];
        const name = actionName(field.name);

        self[field.name] = async (args: Args) => {
          const start = performance.now();
          const timings: number[] = [];

          console.group(`🔧 Action: ${name}`);
          console.log("⏱️  Started at:", new Date().toISOString());

          const produce = args.actions.produce;
          const container = {
            ...args,
            actions: {
              ...args.actions,
              produce: (producer: (model: Record<string, unknown>) => void) => {
                const start = performance.now();
                const result = produce(producer);
                const duration = performance.now() - start;
                timings.push(duration);

                console.log(
                  `  📝 produce #${timings.length}: ${duration.toFixed(2)}ms`,
                );

                return result;
              },
            },
          };

          try {
            const result = await ƒ.call(self, container as Args);
            const total = performance.now() - start;

            console.log("─".repeat(40));
            console.log(`📊 Summary for ${name}:`);
            console.log(`   Total produce calls: ${timings.length}`);
            if (timings.length > 0) {
              console.log(
                `   Produce times: ${timings.map((timing) => timing.toFixed(2) + "ms").join(", ")}`,
              );
            }
            console.log(`   ⏱️  Total duration: ${total.toFixed(2)}ms`);
            console.groupEnd();

            return result;
          } catch (error) {
            const end = performance.now();
            console.error(`❌ Error in ${name}:`, error);
            console.log(`   ⏱️  Failed after: ${(end - start).toFixed(2)}ms`);
            console.groupEnd();
            throw error;
          }
        };
      });
    };
  },
  /**
   * Delays action execution until no new dispatches occur for the specified duration.
   * Useful for search inputs, form validation, and auto-save functionality.
   * Cleans up pending timers if the action is aborted (e.g., component unmounts).
   *
   * @param ms The debounce delay in milliseconds.
   * @returns A decorator function for the action.
   */
  debounce(ms: number) {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];
        const state = {
          timerId: null as ReturnType<typeof setTimeout> | null,
          pendingReject: null as ((reason: unknown) => void) | null,
        };

        self[field.name] = (args: Args) => {
          const controller = args[context].controller;

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
                const result = await ƒ.call(self, args);
                settled.value = true;
                resolve(result);
              } catch (error) {
                settled.value = true;
                reject(error);
              }
            }, ms);
          });
        };
      });
    };
  },
  /**
   * Limits action execution to at most once per specified time window.
   * The first call executes immediately, subsequent calls during the cooldown
   * period are queued and the last one executes when the window expires.
   * Useful for scroll handlers, resize events, and rate-limited APIs.
   *
   * @param ms The throttle window in milliseconds.
   * @returns A decorator function for the action.
   */
  throttle(ms: number) {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];
        const state = {
          lastExecution: 0,
          pendingArgs: null as Args | null,
          timerId: null as ReturnType<typeof setTimeout> | null,
          pendingResolvers: [] as Array<{
            resolve: (value: unknown) => void;
            reject: (reason: unknown) => void;
          }>,
        };

        self[field.name] = async (args: Args) => {
          const controller = args[context].controller;
          const now = Date.now();
          const elapsed = now - state.lastExecution;

          if (elapsed >= ms) {
            state.lastExecution = now;
            return await ƒ.call(self, args);
          }

          state.pendingArgs = args;

          const abortHandler = () => {
            if (state.pendingArgs === args) {
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
                const argsToUse = state.pendingArgs;
                const resolvers = state.pendingResolvers;
                state.pendingArgs = null;
                state.pendingResolvers = [];

                if (
                  !argsToUse ||
                  argsToUse[context].controller.signal.aborted
                ) {
                  resolvers.forEach((r) => r.reject(new AbortError()));
                  return;
                }

                state.lastExecution = Date.now();

                try {
                  const result = await ƒ.call(self, argsToUse);
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
        };
      });
    };
  },
  /**
   * Automatically retries failed actions with specified delay intervals.
   * Respects the abort signal and stops retrying if aborted.
   * Useful for network requests and other operations that may fail transiently.
   *
   * @param intervals Array of delays in milliseconds between retries.
   *                  Defaults to exponential backoff: [1s, 2s, 4s].
   * @returns A decorator function for the action.
   *
   * @example
   * ```ts
   * class MyActions {
   *   // Uses default intervals: 1s, 2s, 4s
   *   @use.retry()
   *   async [FetchData](context) { ... }
   *
   *   // Custom intervals: wait 1s, then 10s, then 50s
   *   @use.retry([1_000, 10_000, 50_000])
   *   async [FetchCriticalData](context) { ... }
   * }
   * ```
   */
  retry(intervals: number[] = [1_000, 2_000, 4_000]) {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];

        self[field.name] = async (args: Args) => {
          const controller = args[context].controller;

          const attempt = async (remaining: number[]): Promise<unknown> => {
            if (controller.signal.aborted) {
              throw new AbortError();
            }

            try {
              return await ƒ.call(self, args);
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

              return attempt(rest);
            }
          };

          return attempt(intervals);
        };
      });
    };
  },
  /**
   * Aborts the action if it exceeds the specified duration.
   * Triggers the abort signal, allowing the action to clean up gracefully.
   * Useful for preventing stuck states and enforcing response time limits.
   *
   * @param ms The timeout duration in milliseconds.
   * @returns A decorator function for the action.
   */
  timeout(ms: number) {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];

        self[field.name] = async (args: Args) => {
          const parent = args[context].controller;
          const ctrl = new AbortController();
          const state = {
            expired: false,
            timer: null as ReturnType<typeof setTimeout> | null,
          };

          const onAbort = () => ctrl.abort();
          parent.signal.addEventListener("abort", onAbort, { once: true });

          state.timer = setTimeout(() => {
            state.timer = null;
            state.expired = true;
            ctrl.abort();
          }, ms);

          const a = {
            ...args,
            signal: ctrl.signal,
            [context]: { controller: ctrl },
          } as Args;

          try {
            return await ƒ.call(self, a);
          } catch (error) {
            if (error instanceof AbortError && state.expired)
              throw new TimeoutError();
            throw error;
          } finally {
            if (state.timer) clearTimeout(state.timer);
            parent.signal.removeEventListener("abort", onAbort);
          }
        };
      });
    };
  },
};
