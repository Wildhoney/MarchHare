import * as React from "react";
import { RefObject } from "react";
import {
  Props,
  Lifecycle,
  Phase,
  Model,
  Actions,
  Filter,
  ActionFilter,
  ActionId,
} from "../types/index.ts";
import type { LifecycleConfig } from "./types.ts";
import type { HandlerContext } from "../types/index.ts";
import { A, G } from "@mobily/ts-belt";
import { useConsumer } from "../boundary/components/consumer/utils.ts";
import { changes } from "../utils.ts";

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
 * Also invokes distributed action handlers with cached values on mount.
 * Updates the phase ref to track the component's current lifecycle state.
 *
 * Note: The phase transitions are:
 * - Mounting → (cached distributed action values emitted here) → Mounted
 * - Mounted → Unmounting → Unmounted
 */
export function useLifecycles({
  unicast,
  distributedActions,
  phase,
  data,
}: LifecycleConfig): void {
  const consumer = useConsumer();
  const previous = React.useRef<Props | null>(null);

  React.useLayoutEffect(() => {
    unicast.emit(Lifecycle.Mount);

    distributedActions.forEach((action) => {
      const entry = consumer.get(action);
      const value = entry?.state.model?.value;
      if (!G.isNullable(value)) unicast.emit(action, value);
    });

    phase.current = Phase.Mounted;

    return () => {
      phase.current = Phase.Unmounting;
      unicast.emit(Lifecycle.Unmount);
      phase.current = Phase.Unmounted;
    };
  }, []);

  React.useEffect(() => void unicast.emit(Lifecycle.Node), []);

  React.useLayoutEffect(() => {
    if (G.isNotNullable(previous.current)) {
      const differences = changes(previous.current, data);
      if (A.isNotEmpty(Object.keys(differences)))
        unicast.emit(Lifecycle.Update, differences);
    }

    previous.current = data;
  }, [data, unicast]);
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
 * import { With } from "chizu";
 *
 * type Model = { name: string; count: number };
 *
 * class Actions {
 *   static SetName = Action<string>("SetName");
 *   static SetCount = Action<number>("SetCount");
 * }
 *
 * // These work - payload types match model property types
 * actions.useAction(Actions.SetName, With("name"));   // string -> string ✓
 * actions.useAction(Actions.SetCount, With("count")); // number -> number ✓
 *
 * // This would error - Country is not assignable to string
 * actions.useAction(Actions.Visitor, With("name")); // Country -> string ✗
 * ```
 */
export function With<K extends string>(
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

/**
 * Checks if the given action is a filtered action tuple `[Action, Filter]`.
 *
 * @param action - The action to check (either a plain ActionId or an ActionFilter tuple)
 * @returns `true` if the action is a filtered action tuple, `false` otherwise
 *
 * @example
 * ```ts
 * isFilteredAction(Actions.Click); // false
 * isFilteredAction([Actions.Click, { UserId: 1 }]); // true
 * ```
 */
export function isFilteredAction(
  action: ActionId | ActionFilter,
): action is ActionFilter {
  return G.isArray(action) && A.length(action) === 2 && G.isObject(action[1]);
}

/**
 * Checks if a dispatch filter matches a registered handler filter.
 * All properties in the dispatch filter must match the corresponding properties in the registered filter.
 *
 * @param dispatchFilter - The filter from the dispatch call
 * @param registeredFilter - The filter registered with useAction
 * @returns `true` if all dispatch filter properties match the registered filter
 *
 * @example
 * ```ts
 * matchesFilter({ UserId: 1 }, { UserId: 1 }); // true
 * matchesFilter({ UserId: 1 }, { UserId: 2 }); // false
 * matchesFilter({ UserId: 1 }, { UserId: 1, Role: "admin" }); // true (subset match)
 * matchesFilter({ UserId: 1, Role: "admin" }, { UserId: 1 }); // false (missing Role)
 * ```
 */
export function matchesFilter(
  dispatchFilter: Filter,
  registeredFilter: Filter,
): boolean {
  for (const key of Object.keys(dispatchFilter)) {
    if (registeredFilter[key] !== dispatchFilter[key]) return false;
  }
  return true;
}
