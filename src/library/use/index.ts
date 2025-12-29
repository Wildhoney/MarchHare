import {
  Args,
  Field,
  Instance,
  Method,
  Primitive,
  DecoratorContext,
} from "./types.ts";
import { Payload, Status, Model, ActionsClass } from "../types/index.ts";
import { actionName, context, internals, reactives, polls } from "./utils.ts";
import { AbortError, Reason, TimeoutError } from "../error/types.ts";
import { A, G } from "@mobily/ts-belt";

export { context, reactives, polls } from "./utils.ts";

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
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];

        self[field.name] = async (args: Args) => {
          internals.get(self)?.controller.abort(Reason.Supplanted);
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
   * - **Context-aware**: Callbacks receive context with current model state
   * - **Primitive dependencies**: Use primitives for reliable change detection
   * - **Separate concerns**: Dependencies trigger the action, payload provides data
   * - **Type-safe payload**: TypeScript enforces `getPayload` returns the correct type
   * - **Null-safe**: Skips execution if checksum fails
   *
   * Combine with `@use.supplant()` if you want new triggers to cancel in-flight requests.
   *
   * @template P The payload type, inferred from the action.
   * @param action The action to trigger. Must match the decorated property.
   * @param getDependencies Function receiving context and returning primitive array. Called every render for change detection.
   * @param getPayload Function receiving context and returning the payload. Called at dispatch time. Only for actions with payloads.
   * @returns A decorator function for the action.
   *
   * @example
   * ```ts
   * // Without typing
   * @use.reactive((ctx) => [ctx.model.userId])
   *
   * // With Model typing (same as useAction)
   * @use.reactive<Model, typeof Actions, "FetchUser">(
   *   (ctx) => [ctx.model.userId],
   *   (ctx) => ({ userId: ctx.model.userId }))
   * ```
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  reactive<
    M extends Model = any,
    AC extends ActionsClass<any> = any,
    K extends Exclude<keyof AC, "prototype"> = any,
  >(
    getDependencies: (context: DecoratorContext<M>) => Primitive[],
    ...args: AC[K] extends Payload<infer P>
      ? [P] extends [never]
        ? []
        : [getPayload: (context: DecoratorContext<M>) => P]
      : []
  ) {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const set = reactives.get(self) ?? new Set();

        set.add({
          action: <Payload>field.name,
          getDependencies: <(context: DecoratorContext) => Primitive[]>(
            getDependencies
          ),
          getPayload: <((context: DecoratorContext) => unknown) | undefined>(
            args[0]
          ),
        });

        reactives.set(self, set);
      });
    };
  },
  /**
   * Polls an action at regular intervals with an optional payload that's evaluated fresh each time.
   *
   * The polling can be paused and resumed using the `getStatus` function. When status
   * returns `Status.Pause`, polling stops until it returns `Status.Play` again.
   *
   * **Features:**
   * - **Context-aware**: Callbacks receive context with current model state
   * - **Fixed interval polling**: Executes action every `ms` milliseconds
   * - **Fresh payload**: `getPayload` is called at each interval for current values
   * - **Pausable**: Use `getStatus` to pause/resume polling dynamically
   * - **Auto cleanup**: Intervals are cleared on component unmount
   * - **Type-safe payload**: TypeScript enforces `getPayload` returns the correct type
   *
   * @template P The payload type, inferred from the action.
   * @param action The action to trigger. Must match the decorated property.
   * @param ms The polling interval in milliseconds.
   * @param getPayload Function receiving context and returning the payload. Called at each interval for fresh values. Only for actions with payloads.
   * @param getStatus Function receiving context and returning Status.Play or Status.Pause. Defaults to always playing.
   * @returns A decorator function for the action.
   *
   * @example
   * ```ts
   * // Without typing
   * @use.poll(1_000)
   *
   * // With Model typing (same as useAction)
   * @use.poll<Model, typeof Actions, "Increment">(1_000,
   *   (ctx) => ctx.model.count < 10 ? Status.Play : Status.Pause)
   * ```
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  poll<
    M extends Model = any,
    AC extends ActionsClass<any> = any,
    K extends Exclude<keyof AC, "prototype"> = any,
  >(
    ms: number,
    ...args: AC[K] extends Payload<infer P>
      ? [P] extends [never]
        ? []
        : [getPayload: (context: DecoratorContext<M>) => P]
      : []
  ) {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const set = polls.get(self) ?? new Set();

        set.add({
          action: <Payload>field.name,
          interval: ms,
          getPayload: <((context: DecoratorContext) => unknown) | undefined>(
            args[0]
          ),
          getStatus: () => Status.Play,
        });

        polls.set(self, set);
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
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];
        const name = actionName(field.name);
        const isTest = process.env.NODE_ENV === "test";

        self[field.name] = async (args: Args) => {
          const start = performance.now();
          const state = { timings: <number[]>[] };

          if (!isTest) {
            console.group(`🔧 Action: ${name}`);
            console.log("⏱️  Started at:", new Date().toISOString());
          }

          const container = {
            ...args,
            actions: {
              ...args.actions,
              produce: (producer: (model: Record<string, unknown>) => void) => {
                const start = performance.now();
                const result = args.actions.produce(producer);
                const duration = performance.now() - start;
                state.timings.push(duration);

                if (!isTest) {
                  console.log(
                    `  📝 produce #${state.timings.length}: ${duration.toFixed(2)}ms`,
                  );
                }

                return result;
              },
            },
          };

          try {
            const result = await ƒ.call(self, <Args>container);
            const total = performance.now() - start;

            if (!isTest) {
              console.log("─".repeat(40));
              console.log(`📊 Summary for ${name}:`);
              console.log(`   Total produce calls: ${state.timings.length}`);
              if (A.isNotEmpty(state.timings)) {
                console.log(
                  `   Produce times: ${state.timings.map((timing) => timing.toFixed(2) + "ms").join(", ")}`,
                );
              }
              console.log(`   ⏱️  Total duration: ${total.toFixed(2)}ms`);
              console.groupEnd();
            }

            return result;
          } catch (error) {
            if (!isTest) {
              const end = performance.now();
              console.error(`❌ Error in ${name}:`, error);
              console.log(`   ⏱️  Failed after: ${(end - start).toFixed(2)}ms`);
              console.groupEnd();
            }
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
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];
        const state = {
          timerId: <ReturnType<typeof setTimeout> | null>null,
          pendingReject: <((reason: unknown) => void) | null>null,
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
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = <Instance>this;
        const ƒ = <Method>self[field.name];

        const state = {
          lastExecution: 0,
          pendingArgs: <Args | null>null,
          timerId: <ReturnType<typeof setTimeout> | null>null,
          pendingResolvers: <
            {
              resolve(value: unknown): void;
              reject(reason: unknown): void;
            }[]
          >[],
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
                const args = state.pendingArgs;
                const resolvers = state.pendingResolvers;
                state.pendingArgs = null;
                state.pendingResolvers = [];

                if (
                  G.isNullable(args) ||
                  args[context].controller.signal.aborted
                ) {
                  resolvers.forEach((r) => r.reject(new AbortError()));
                  return;
                }

                state.lastExecution = Date.now();

                try {
                  const result = await ƒ.call(self, args);
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
    return function (_: unknown, field: Field) {
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
          const state = { timer: <ReturnType<typeof setTimeout> | null>null };

          try {
            return await Promise.race([
              ƒ.call(self, args),
              new Promise<never>((_, reject) => {
                state.timer = setTimeout(() => {
                  args[context].controller.abort(new TimeoutError());
                  reject(new TimeoutError());
                }, ms);
              }),
            ]);
          } finally {
            if (state.timer) clearTimeout(state.timer);
          }
        };
      });
    };
  },
};
