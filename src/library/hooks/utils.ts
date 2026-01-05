import * as React from "react";
import { RefObject } from "react";
import { G } from "@mobily/ts-belt";
import { Props, Lifecycle, Status, Model } from "../types/index.ts";
import { reactives, polls } from "../use/index.ts";
import * as utils from "../utils/index.ts";
import { Reason } from "../error/types.ts";
import type {
  ReactivesConfig,
  PollingsConfig,
  LifecycleConfig,
} from "./types.ts";

/**
 * @name withGetters
 * @description This function creates a new object with getters for each property of the input object.
 * The getters retrieve the current value from a ref, ensuring that the latest value is always accessed.
 * @param {P} a The object to create getters for.
 * @param {RefObject<P>} b The ref object containing the current values.
 * @returns {P} A new object with getters that access the current values from the ref.
 */
export function withGetters<P extends Props>(a: P, b: RefObject<P>): P {
  return Object.keys(a).reduce(
    (proxy, key) => {
      Object.defineProperty(proxy, key, {
        get() {
          return b.current[key];
        },
        enumerable: true,
      });

      return proxy;
    },
    <P>{},
  );
}
/**
 * @name isGenerator
 * @description Checks if the given result is a generator or async generator.
 * @param result The result to check.
 * @returns {boolean} True if the result is a generator or async generator, false otherwise.
 */
export function isGenerator(
  result: unknown,
): result is Generator | AsyncGenerator {
  if (!result) return false;
  if (typeof result !== "object" || result === null) return false;
  const name = (<object>result).constructor.name;
  return name === "Generator" || name === "AsyncGenerator";
}

/**
 * Tracks reactive dependencies and dispatches actions when dependencies change.
 *
 * For each action decorated with `@use.reactive`, this hook:
 * - Evaluates the dependency function to get primitive values
 * - Computes a checksum of the dependencies
 * - Compares against the previous checksum
 * - Dispatches the action with payload if dependencies changed
 *
 * @template M The model type extending Model.
 * @param config Configuration object containing actions, model state, and unicast emitter.
 */
export function useReactives<M extends Model>({
  actions,
  model,
  state,
  checksums,
  unicast,
}: ReactivesConfig<M>): void {
  const run = React.useEffectEvent(() => {
    reactives.get(<object>actions)?.forEach((entry) => {
      const context = { model, inspect: state.current.inspect };
      const dependencies = entry.getDependencies(context);
      const checksum = utils.checksum(dependencies);
      if (G.isNullable(checksum)) return;
      const previous = checksums.current.get(entry.action) ?? null;
      if (checksum === previous) return;
      checksums.current.set(entry.action, checksum);
      const payload = entry.getPayload?.(context);
      unicast.emit(entry.action, payload);
    });
  });

  React.useEffect(() => {
    run();
  });
}

/**
 * Emits lifecycle events for component mount/unmount and DOM attachment.
 *
 * - `Lifecycle.Mount`: Emitted synchronously in useLayoutEffect on mount
 * - `Lifecycle.Unmount`: Emitted on cleanup when component unmounts (after aborting all actions)
 * - `Lifecycle.Node`: Emitted in useEffect after first render (DOM available)
 *
 * On unmount, all in-flight actions belonging to this component's regulator are aborted
 * before emitting the unmount event, ensuring proper cleanup of async operations.
 *
 * @param config Configuration containing unicast emitter and regulator reference.
 */
export function useLifecycle({ unicast, regulator }: LifecycleConfig): void {
  React.useLayoutEffect(() => {
    unicast.emit(Lifecycle.Mount);
    return () => {
      regulator.current.abort.own(Reason.Unmounted);
      unicast.emit(Lifecycle.Unmount);
    };
  }, []);

  React.useEffect(() => void unicast.emit(Lifecycle.Node), []);
}

/**
 * Sets up polling intervals for actions decorated with `@use.poll`.
 *
 * For each polling entry:
 * - Creates a setInterval with the configured interval
 * - Checks the status function each tick (skips if paused)
 * - Evaluates the payload function and dispatches the action
 * - Cleans up all intervals on unmount
 *
 * @param config Configuration object containing actions, snapshot, and unicast emitter.
 */
export function usePollings({
  actions,
  snapshot,
  unicast,
}: PollingsConfig): void {
  React.useEffect(() => {
    const pollings = polls.get(<object>actions);
    if (G.isNullable(pollings)) return;

    const intervals: ReturnType<typeof setInterval>[] = [];

    pollings.forEach((entry) => {
      const intervalId = setInterval(() => {
        if (entry.getStatus(snapshot) === Status.Pause) return;
        const payload = entry.getPayload?.(snapshot);
        unicast.emit(entry.action, payload);
      }, entry.interval);
      intervals.push(intervalId);
    });

    return () => {
      intervals.forEach((id) => clearInterval(id));
    };
  }, [unicast, actions]);
}
