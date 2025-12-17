import { Args, Field, Instance, Method, Primitive } from "./types.ts";
import { actionName, context, internals, entries } from "./utils.ts";

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
  exclusive() {
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
                `   Produce times: ${timings.map((t) => t.toFixed(2) + "ms").join(", ")}`,
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
  // /**
  //  * Delays action execution until no new dispatches occur for the specified duration.
  //  * Useful for search inputs, form validation, and auto-save functionality.
  //  * Cleans up pending timers if the action is aborted (e.g., component unmounts).
  //  *
  //  * @param ms The debounce delay in milliseconds.
  //  * @returns A decorator function for the action.
  //  */
  // debounce(ms: number) {
  //   return function (_: undefined, field: Field) {
  //     field.addInitializer(function () {
  //       const self = <Instance>this;
  //       const ƒ = <Method>self[field.name];
  //       let timerId: ReturnType<typeof setTimeout> | null = null;
  //       let pendingReject: ((reason: unknown) => void) | null = null;

  //       self[field.name] = (args: Args) => {
  //         if (timerId) {
  //           clearTimeout(timerId);
  //           if (pendingReject) {
  //             pendingReject(new DOMException("Debounced", "AbortError"));
  //             pendingReject = null;
  //           }
  //         }

  //         return new Promise((resolve, reject) => {
  //           pendingReject = reject;

  //           const cleanup = () => {
  //             if (timerId) {
  //               clearTimeout(timerId);
  //               timerId = null;
  //             }
  //           };

  //           args.signal.addEventListener("abort", cleanup, { once: true });

  //           timerId = setTimeout(async () => {
  //             timerId = null;
  //             pendingReject = null;
  //             args.signal.removeEventListener("abort", cleanup);

  //             if (args.signal.aborted) {
  //               reject(new DOMException("Aborted", "AbortError"));
  //               return;
  //             }

  //             try {
  //               resolve(await ƒ.call(self, args));
  //             } catch (error) {
  //               reject(error);
  //             }
  //           }, ms);
  //         });
  //       };
  //     });
  //   };
  // },
  // /**
  //  * Limits action execution to at most once per specified time window.
  //  * The first call executes immediately, subsequent calls during the cooldown
  //  * period are queued and the last one executes when the window expires.
  //  * Useful for scroll handlers, resize events, and rate-limited APIs.
  //  *
  //  * @param ms The throttle window in milliseconds.
  //  * @returns A decorator function for the action.
  //  */
  // throttle(ms: number) {
  //   return function (_: undefined, field: Field) {
  //     field.addInitializer(function () {
  //       const self = <Instance>this;
  //       const ƒ = <Method>self[field.name];
  //       let lastExecution = 0;
  //       let pendingArgs: Args | null = null;
  //       let timerId: ReturnType<typeof setTimeout> | null = null;

  //       self[field.name] = async (args: Args) => {
  //         const now = Date.now();
  //         const elapsed = now - lastExecution;

  //         const cleanup = () => {
  //           if (timerId) {
  //             clearTimeout(timerId);
  //             timerId = null;
  //           }
  //           pendingArgs = null;
  //         };

  //         args.signal.addEventListener("abort", cleanup, { once: true });

  //         if (elapsed >= ms) {
  //           lastExecution = now;
  //           args.signal.removeEventListener("abort", cleanup);
  //           return await ƒ.call(self, args);
  //         }

  //         pendingArgs = args;

  //         if (!timerId) {
  //           return new Promise((resolve, reject) => {
  //             timerId = setTimeout(async () => {
  //               timerId = null;
  //               const argsToUse = pendingArgs;
  //               pendingArgs = null;

  //               if (!argsToUse || argsToUse.signal.aborted) {
  //                 reject(new DOMException("Aborted", "AbortError"));
  //                 return;
  //               }

  //               lastExecution = Date.now();
  //               argsToUse.signal.removeEventListener("abort", cleanup);

  //               try {
  //                 resolve(await ƒ.call(self, argsToUse));
  //               } catch (error) {
  //                 reject(error);
  //               }
  //             }, ms - elapsed);
  //           });
  //         }

  //         return new Promise((resolve) => {
  //           const checkPending = setInterval(() => {
  //             if (!timerId && pendingArgs !== args) {
  //               clearInterval(checkPending);
  //               resolve(undefined);
  //             }
  //           }, 10);

  //           args.signal.addEventListener(
  //             "abort",
  //             () => {
  //               clearInterval(checkPending);
  //               resolve(undefined);
  //             },
  //             { once: true },
  //           );
  //         });
  //       };
  //     });
  //   };
  // },
  // /**
  //  * Automatically retries failed actions up to the specified number of attempts.
  //  * Respects the abort signal and stops retrying if aborted.
  //  * Useful for network requests and other operations that may fail transiently.
  //  *
  //  * @param attempts The maximum number of attempts (including the initial try).
  //  * @param delayMs Optional delay between retries in milliseconds (default: 0).
  //  * @returns A decorator function for the action.
  //  */
  // retry(attempts: number, delayMs: number = 0) {
  //   return function (_: undefined, field: Field) {
  //     field.addInitializer(function () {
  //       const self = <Instance>this;
  //       const ƒ = <Method>self[field.name];

  //       self[field.name] = async (args: Args) => {
  //         let lastError: unknown;

  //         for (let attempt = 1; attempt <= attempts; attempt++) {
  //           if (args.signal.aborted) {
  //             throw new DOMException("Aborted", "AbortError");
  //           }

  //           try {
  //             return await ƒ.call(self, args);
  //           } catch (error) {
  //             lastError = error;

  //             if (attempt < attempts && !args.signal.aborted) {
  //               if (delayMs > 0) {
  //                 await new Promise<void>((resolve, reject) => {
  //                   const timerId = setTimeout(resolve, delayMs);
  //                   args.signal.addEventListener(
  //                     "abort",
  //                     () => {
  //                       clearTimeout(timerId);
  //                       reject(new DOMException("Aborted", "AbortError"));
  //                     },
  //                     { once: true },
  //                   );
  //                 });
  //               }
  //             }
  //           }
  //         }

  //         throw lastError;
  //       };
  //     });
  //   };
  // },
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
          const controller = args[context].controller;
          let timerId: ReturnType<typeof setTimeout> | null = null;
          let timedOut = false;

          const cleanup = () => {
            if (timerId) {
              clearTimeout(timerId);
              timerId = null;
            }
          };

          timerId = setTimeout(() => {
            timerId = null;
            timedOut = true;
            controller.abort();
          }, ms);

          controller.signal.addEventListener("abort", cleanup, { once: true });

          try {
            return await ƒ.call(self, args);
          } catch (error) {
            if (
              error instanceof DOMException &&
              error.name === "AbortError" &&
              timedOut
            ) {
              throw new DOMException("Timeout", "TimeoutError");
            }
            throw error;
          } finally {
            cleanup();
          }
        };
      });
    };
  },
};
