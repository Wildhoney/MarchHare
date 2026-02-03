import * as React from "react";
import { RefObject } from "react";
import {
  Props,
  Lifecycle,
  Phase,
  Model,
  Actions,
  Filter,
  Nodes,
} from "../types/index.ts";
import type { LifecycleConfig, References } from "./types.ts";
import type { HandlerContext } from "../types/index.ts";
import { A, G } from "@mobily/ts-belt";
import { useConsumer } from "../boundary/components/consumer/utils.ts";
import { changes } from "../utils.ts";
import { isChanneledAction, getActionSymbol } from "../action/index.ts";

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
 * Also invokes broadcast action handlers with cached values on mount.
 * Updates the phase ref to track the component's current lifecycle state.
 *
 * Note: The phase transitions are:
 * - Mounting → (cached broadcast action values emitted here) → Mounted
 * - Mounted → Unmounting → Unmounted
 */
export function useLifecycles({
  unicast,
  broadcastActions,
  phase,
  data,
}: LifecycleConfig): void {
  const consumer = useConsumer();
  const previous = React.useRef<Props | null>(null);

  React.useLayoutEffect(() => {
    unicast.emit(Lifecycle.Mount);

    broadcastActions.forEach((action) => {
      const entry = consumer.get(action);
      const value = entry?.state.model?.value;
      if (!G.isNullable(value)) unicast.emit(action, value);
    });

    phase.current = Phase.Mounted;
    // Unmount emission handled in handler cleanup (index.ts) to ensure handlers receive it
  }, []);

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

// Re-export isChanneledAction and getActionSymbol for convenience
export { isChanneledAction, getActionSymbol };

/**
 * Manages captured DOM nodes for a model type.
 * Returns refs for nodes, pending captures, and last emitted nodes.
 *
 * @template M The model type containing a `nodes` property
 * @returns Object containing refs for nodes, pending captures, and emitted nodes
 */
export function useNodes<M extends Model>(): References<M> {
  type N = Nodes<M>;
  const refs = React.useRef<{ [K in keyof N]: N[K] | null }>(
    <{ [K in keyof N]: N[K] | null }>{},
  );
  const pending = React.useRef<Map<keyof N, N[keyof N] | null>>(new Map());
  const emitted = React.useRef<Map<keyof N, N[keyof N] | null>>(new Map());
  return React.useMemo(() => ({ refs, pending, emitted }), []);
}

/**
 * Checks if a dispatch channel matches a registered handler channel.
 * All properties in the dispatch channel must match the corresponding properties in the registered channel.
 *
 * @param dispatchChannel - The channel from the dispatch call (from ChanneledAction)
 * @param registeredChannel - The channel registered with useAction
 * @returns `true` if all dispatch channel properties match the registered channel
 *
 * @example
 * ```ts
 * matchesChannel({ UserId: 1 }, { UserId: 1 }); // true
 * matchesChannel({ UserId: 1 }, { UserId: 2 }); // false
 * matchesChannel({ UserId: 1 }, { UserId: 1, Role: "admin" }); // true (subset match)
 * matchesChannel({ UserId: 1, Role: "admin" }, { UserId: 1 }); // false (missing Role)
 * ```
 */
export function matchesChannel(
  dispatchChannel: Filter,
  registeredChannel: Filter,
): boolean {
  for (const key of Object.keys(dispatchChannel)) {
    if (registeredChannel[key] !== dispatchChannel[key]) return false;
  }
  return true;
}
