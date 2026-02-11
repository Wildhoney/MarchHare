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
  ActionId,
  HandlerPayload,
  ChanneledAction,
  HandlerContext,
} from "../types/index.ts";

import type { LifecycleConfig, References, Handler, Scope } from "./types.ts";
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
 * Emits lifecycle events for component mount and DOM attachment.
 * Also invokes broadcast action handlers with cached values on mount.
 * Updates the phase ref to track the component's current lifecycle state.
 *
 * Uses a ref guard to prevent React Strict Mode from causing duplicate
 * Mount emissions during its development-only double-invocation cycle.
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
    if (phase.current !== Phase.Mounting) return;

    unicast.emit(Lifecycle.Mount);

    broadcastActions.forEach((action) => {
      const entry = consumer.get(action);
      const value = entry?.state.model?.value;
      if (!G.isNullable(value)) unicast.emit(action, value);
    });

    phase.current = Phase.Mounted;
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
 * Return type for useActionSets hook.
 */
export type ActionSets = {
  /** Set of registered broadcast action IDs */
  broadcast: Set<ActionId>;
  /** Set of registered multicast action IDs */
  multicast: Set<ActionId>;
};

/**
 * Manages sets of broadcast and multicast action IDs.
 *
 * This hook creates stable refs for tracking which actions have been registered
 * as broadcast or multicast within a component. These sets are used to:
 * - Replay cached broadcast values on mount
 * - Track multicast subscriptions for scope-based dispatch
 *
 * @returns Object with `broadcast` and `multicast` Sets for action tracking
 *
 * @example
 * ```ts
 * const actions = useActionSets();
 *
 * // Register a broadcast action
 * actions.broadcast.add(getActionSymbol(MyBroadcastAction));
 *
 * // Check if an action is registered as multicast
 * if (actions.multicast.has(actionId)) {
 *   // Handle multicast dispatch
 * }
 * ```
 *
 * @internal
 */
export function useActionSets(): ActionSets {
  const broadcast = React.useRef<Set<ActionId>>(new Set());
  const multicast = React.useRef<Set<ActionId>>(new Set());

  return React.useMemo(
    () => ({
      broadcast: broadcast.current,
      multicast: multicast.current,
    }),
    [],
  );
}

/**
 * Registers an action handler within a component's scope.
 *
 * This hook binds a handler function to an action, supporting both regular and channeled
 * actions. The handler is wrapped with `useEffectEvent` to ensure it always has access
 * to the latest closure values while maintaining a stable reference.
 *
 * For generator handlers (sync or async), the hook automatically iterates through
 * all yielded values to completion.
 *
 * @template M - The model type representing the component's state
 * @template AC - The actions class containing action definitions
 * @template D - The data type for reactive external values
 *
 * @param scope - Ref to the component's handler scope containing registered handlers
 * @param action - The action to register (ActionId, HandlerPayload, or ChanneledAction)
 * @param handler - The handler function to invoke when the action is dispatched
 *
 * @example
 * ```ts
 * useRegisterHandler(scope, Actions.Increment, async (context, payload) => {
 *   context.actions.produce((draft) => {
 *     draft.model.count += payload;
 *   });
 * });
 *
 * // With channeled action
 * useRegisterHandler(scope, Actions.UserUpdated({ UserId: 5 }), (context, user) => {
 *   // Only called when UserId matches 5
 * });
 * ```
 *
 * @internal
 */
export function useRegisterHandler<
  M extends Model | void,
  AC extends Actions,
  D extends Props,
>(
  scope: React.RefObject<Scope<M, AC, D>>,
  action: ActionId | HandlerPayload | ChanneledAction,
  handler: (
    context: HandlerContext<M, AC, D>,
    payload: unknown,
  ) => void | Promise<void> | AsyncGenerator | Generator,
): void {
  // Store latest handler in ref to avoid stale closures (replaces useEffectEvent)
  const handlerRef = React.useRef(handler);
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  // Store latest action for channel resolution
  const actionRef = React.useRef(action);
  React.useLayoutEffect(() => {
    actionRef.current = action;
  });

  // Stable handler wrapper that always calls the latest handler
  const stableHandler = React.useCallback(
    async (context: HandlerContext<M, AC, D>, payload: unknown) => {
      const currentHandler = handlerRef.current;
      const isGeneratorFn =
        currentHandler.constructor.name === "GeneratorFunction" ||
        currentHandler.constructor.name === "AsyncGeneratorFunction";

      if (isGeneratorFn) {
        const generator = <Generator | AsyncGenerator>(
          currentHandler(context, payload)
        );
        for await (const _ of generator) void 0;
      } else {
        await currentHandler(context, payload);
      }
    },
    [],
  );

  // Stable channel getter
  const getChannel = React.useCallback(
    (): Filter | undefined =>
      isChanneledAction(actionRef.current)
        ? <Filter>actionRef.current.channel
        : undefined,
    [],
  );

  const base = getActionSymbol(action);
  const entries = scope.current.handlers.get(base) ?? new Set();
  if (entries.size === 0) scope.current.handlers.set(base, entries);
  entries.add({ getChannel, handler: <Handler<M, AC, D>>stableHandler });
}

/**
 * Manages captured DOM nodes for a model type.
 * Returns refs for nodes, pending captures, and last emitted nodes.
 *
 * @template M The model type containing a `nodes` property
 * @returns Object containing refs for nodes, pending captures, and emitted nodes
 */
export function useNodes<M extends Model | void>(): References<M> {
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
