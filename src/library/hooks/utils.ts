import * as React from "react";
import { RefObject } from "react";
import { G } from "@mobily/ts-belt";
import { Props, Lifecycle, Status, Model } from "../types/index.ts";
import * as utils from "../utils/index.ts";
import { Reason } from "../error/types.ts";
import type {
  ReactivesConfig,
  PollingsConfig,
  LifecycleConfig,
} from "./types.ts";

/**
 * Creates a new object with getters for each property of the input object.
 * The getters retrieve the current value from a ref, ensuring that the latest value is always accessed.
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
 * Checks if the given result is a generator or async generator.
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
 */
export function useReactives<M extends Model>({
  model,
  state,
  checksums,
  scope,
  unicast,
}: ReactivesConfig<M>): void {
  const run = React.useEffectEvent(() => {
    scope.current.reactives.forEach((entry) => {
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
 * Sets up polling intervals for actions registered with Use.Poll().
 */
export function usePollings<M extends Model>({
  state,
  scope,
  unicast,
}: PollingsConfig<M>): void {
  React.useEffect(() => {
    if (scope.current.polls.size === 0) return;

    const intervals: ReturnType<typeof setInterval>[] = [];

    scope.current.polls.forEach((entry) => {
      const intervalId = setInterval(() => {
        const snapshot = {
          model: state.current.model,
          inspect: state.current.inspect,
        };
        if (entry.getStatus(snapshot) === Status.Pause) return;
        const payload = entry.getPayload?.(snapshot);
        unicast.emit(entry.action, payload);
      }, entry.interval);
      intervals.push(intervalId);
    });

    return () => {
      intervals.forEach((id) => clearInterval(id));
    };
  }, [unicast]);
}
