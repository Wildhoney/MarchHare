import * as React from "react";
import { RefObject } from "react";
import { Props, Lifecycle } from "../types/index.ts";
import { Reason } from "../error/types.ts";
import type { LifecycleConfig } from "./types.ts";

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
