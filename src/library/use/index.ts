import { Args, Field, Instance, Method, Primitive } from "./types.ts";
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
   * Dependencies must be primitives (strings, numbers, booleans, etc.) to avoid
   * referential equality issues.
   *
   * @param getDependencies A function returning an array of primitive dependencies.
   * @returns A decorator function for the action.
   */
  reactive(getDependencies: () => Primitive[]) {
    return function (_: undefined, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const list = entries.get(self) ?? [];

        list.push({
          action: field.name,
          getDependencies,
        });

        entries.set(self, list);
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
          let produceCount = 0;
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
                produceCount++;
                const start = performance.now();
                const result = produce(producer);
                const end = performance.now();
                const duration = end - start;
                timings.push(duration);

                console.log(
                  `  📝 produce #${produceCount}: ${duration.toFixed(2)}ms`,
                );

                return result;
              },
            },
          };

          try {
            const result = await ƒ.call(self, container as Args);
            const end = performance.now();
            const total = end - start;

            console.log("─".repeat(40));
            console.log(`📊 Summary for ${name}:`);
            console.log(`   Total produce calls: ${produceCount}`);
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
        let timerId: ReturnType<typeof setTimeout> | null = null;
        let pendingReject: ((reason: unknown) => void) | null = null;

        self[field.name] = (args: Args) => {
          const controller = args[context].controller;

          if (timerId) {
            clearTimeout(timerId);
            if (pendingReject) {
              pendingReject(new AbortError());
              pendingReject = null;
            }
          }

          return new Promise((resolve, reject) => {
            pendingReject = reject;
            let settled = false;

            const cleanup = () => {
              if (timerId) {
                clearTimeout(timerId);
                timerId = null;
              }
              pendingReject = null;
            };

            controller.signal.addEventListener(
              "abort",
              () => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new AbortError());
              },
              { once: true },
            );

            timerId = setTimeout(async () => {
              if (settled) return;
              timerId = null;
              pendingReject = null;

              if (controller.signal.aborted) {
                settled = true;
                reject(new AbortError());
                return;
              }

              try {
                const result = await ƒ.call(self, args);
                settled = true;
                resolve(result);
              } catch (error) {
                settled = true;
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
        let lastExecution = 0;
        let pendingArgs: Args | null = null;
        let timerId: ReturnType<typeof setTimeout> | null = null;
        let pendingResolvers: Array<{
          resolve: (value: unknown) => void;
          reject: (reason: unknown) => void;
        }> = [];

        self[field.name] = async (args: Args) => {
          const controller = args[context].controller;
          const now = Date.now();
          const elapsed = now - lastExecution;

          if (elapsed >= ms) {
            lastExecution = now;
            return await ƒ.call(self, args);
          }

          pendingArgs = args;

          const abortHandler = () => {
            if (pendingArgs === args) {
              pendingArgs = null;
            }
          };
          controller.signal.addEventListener("abort", abortHandler, {
            once: true,
          });

          if (!timerId) {
            return new Promise((resolve, reject) => {
              pendingResolvers.push({ resolve, reject });

              timerId = setTimeout(async () => {
                timerId = null;
                const argsToUse = pendingArgs;
                const resolvers = pendingResolvers;
                pendingArgs = null;
                pendingResolvers = [];

                if (
                  !argsToUse ||
                  argsToUse[context].controller.signal.aborted
                ) {
                  resolvers.forEach((r) => r.reject(new AbortError()));
                  return;
                }

                lastExecution = Date.now();

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
            pendingResolvers.push({ resolve, reject });
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
          let lastError: unknown;
          const maxAttempts = intervals.length + 1;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (controller.signal.aborted) {
              throw new AbortError();
            }

            try {
              return await ƒ.call(self, args);
            } catch (error) {
              if (error instanceof AbortError) {
                throw error;
              }

              lastError = error;
              const nextInterval = intervals[attempt];
              if (nextInterval !== undefined && !controller.signal.aborted) {
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
              }
            }
          }

          throw lastError;
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
          const parentController = args[context].controller;
          const timeoutController = new AbortController();

          const onParentAbort = () => timeoutController.abort();
          parentController.signal.addEventListener("abort", onParentAbort, {
            once: true,
          });

          let timedOut = false;
          let timerId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            timerId = null;
            timedOut = true;
            timeoutController.abort();
          }, ms);

          const timeoutArgs = {
            ...args,
            signal: timeoutController.signal,
            [context]: { controller: timeoutController },
          } as Args;

          try {
            return await ƒ.call(self, timeoutArgs);
          } catch (error) {
            if (error instanceof AbortError && timedOut)
              throw new TimeoutError();
            throw error;
          } finally {
            if (timerId) clearTimeout(timerId);
            parentController.signal.removeEventListener("abort", onParentAbort);
          }
        };
      });
    };
  },
};
