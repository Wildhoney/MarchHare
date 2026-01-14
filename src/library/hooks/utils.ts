import * as React from "react";
import { RefObject } from "react";
import { Props, Lifecycle, Model, Actions } from "../types/index.ts";
import type { LifecycleConfig } from "./types.ts";
import type { HandlerContext } from "../types/index.ts";

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
export function useLifecycles({ unicast }: LifecycleConfig): void {
  React.useLayoutEffect(() => {
    unicast.emit(Lifecycle.Mount);
    return () => void unicast.emit(Lifecycle.Unmount);
  }, []);

  React.useEffect(() => void unicast.emit(Lifecycle.Node), []);
}

/**
 * Creates a data proxy for a given object, returning a memoized version.
 * The proxy provides stable access to the object's properties,
 * even as the original object changes across renders.
 *
 * This is an internal utility used by useActions to provide stable
 * access to reactive values in async action handlers via `context.data`.
 *
 * @template P The type of the object.
 * @param props The object to create a data proxy for.
 * @returns A memoized data proxy of the object.
 */
export function useData<P extends Props>(props: P): P {
  const ref = React.useRef<P>(props);
  React.useLayoutEffect((): void => void (ref.current = props), [props]);
  return React.useMemo(() => withGetters<P>(props, ref), [props]);
}

/**
 * Creates a handler that binds an action's payload directly to a model property.
 *
 * The returned handler updates `model[key]` with the payload when the action is dispatched.
 * Type safety is enforced at the call site: the payload type must be assignable to
 * the model property's type.
 *
 * @template K The property key type (inferred from the argument)
 * @param key The model property key to bind the payload to
 * @returns A handler function compatible with `useAction`
 *
 * @example
 * ```ts
 * type Model = { name: string; count: number };
 *
 * class Actions {
 *   static SetName = Action<string>("SetName");
 *   static SetCount = Action<number>("SetCount");
 * }
 *
 * // These work - payload types match model property types
 * actions.useAction(Actions.SetName, Bound("name"));   // string -> string ✓
 * actions.useAction(Actions.SetCount, Bound("count")); // number -> number ✓
 *
 * // This would error - Country is not assignable to string
 * actions.useAction(Actions.Visitor, Bound("name")); // Country -> string ✗
 * ```
 */
export function Bound<K extends string>(
  key: K,
): <
  M extends Model,
  AC extends Actions,
  D extends Props,
  P extends K extends keyof M ? M[K] : never,
>(
  context: HandlerContext<M, AC, D>,
  payload: P,
) => void {
  return (context, payload) => {
    context.actions.produce((draft) => {
      draft.model[<keyof typeof draft.model>key] = payload;
    });
  };
}
