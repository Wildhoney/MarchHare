import { Operation } from "immertation";
import { Process, Inspect, Box } from "immertation";
import type {
  ActionId,
  Task,
  Tasks,
} from "../boundary/components/tasks/types.ts";
import type { ConsumerRenderer } from "../boundary/components/consumer/index.tsx";
import type * as React from "react";

export type { ActionId, Box, Task, Tasks };
export type { ConsumerRenderer };

/**
 * Lifecycle actions that trigger at specific points in a component's lifecycle.
 * Define handlers for these in your actions class to respond to lifecycle events.
 *
 * @example
 * ```ts
 * class {
 *   [Lifecycle.Mount] = mountAction;
 *   [Lifecycle.Error] = errorAction;
 *   [Lifecycle.Unmount] = unmountAction;
 * }
 * ```
 */
export class Lifecycle {
  /** Triggered once when the component mounts (`useLayoutEffect`). */
  static Mount = Symbol("chizu.action.lifecycle/Mount");
  /** Triggered once after the component mounts (`useEffect` with empty deps `[]`). */
  static Node = Symbol("chizu.action.lifecycle/Node");
  /** Triggered when the component unmounts. */
  static Unmount = Symbol("chizu.action.lifecycle/Unmount");
  /** Triggered when an action throws an error. Receives `Fault` as payload. */
  static Error = Symbol("chizu.action.lifecycle/Error");
  /** Triggered when `context.data` has changed. Not fired on initial mount. Receives `Record<string, unknown>` payload with changed keys. */
  static Update = Symbol("chizu.action.lifecycle/Update");
}

/**
 * Distribution modes for actions.
 *
 * - **Unicast** &ndash; Action is scoped to the component that defines it and cannot be
 *   consumed by other components. This is the default behavior.
 * - **Broadcast** &ndash; Action is distributed to all mounted components that have defined
 *   a handler for it. Can be consumed with `actions.consume()`.
 *
 * @example
 * ```ts
 * export class Actions {
 *   // Unicast action (default) - local to this component
 *   static Increment = new Action("Increment");
 *
 *   // Broadcast action - can be consumed across components
 *   static Counter = new Action("Counter", Distribution.Broadcast);
 * }
 * ```
 */
export enum Distribution {
  /** Action is scoped to the component that defines it. This is the default. */
  Unicast = "unicast",
  /** Action is broadcast to all mounted components and can be consumed. */
  Broadcast = "broadcast",
}

/**
 * Lifecycle phase of a component using useActions.
 * Tracks whether the component is in the process of mounting, fully mounted,
 * unmounting, or completely unmounted.
 *
 * @example
 * ```ts
 * actions.useAction(Actions.Counter, (context, payload) => {
 *   if (context.phase === Phase.Mounting) {
 *     // Handler called during mount (e.g., cached distributed action value)
 *   } else if (context.phase === Phase.Mounted) {
 *     // Handler called after component is fully mounted
 *   }
 * });
 * ```
 */
export enum Phase {
  /** Component is in the process of mounting (before useLayoutEffect completes). */
  Mounting = "mounting",
  /** Component has fully mounted (after useLayoutEffect). */
  Mounted = "mounted",
  /** Component is in the process of unmounting. */
  Unmounting = "unmounting",
  /** Component has fully unmounted. */
  Unmounted = "unmounted",
}

/**
 * Primary key type for identifying entities in collections.
 * Can be undefined (not yet assigned), a symbol (temporary/local), or a concrete value T.
 *
 * @template T - The concrete primary key type (e.g., string, number)
 */
export type Pk<T> = undefined | symbol | T;

/**
 * Base constraint type for model state objects.
 * Models must be plain objects with string keys.
 *
 * @template M - The specific model shape
 */
export type Model<M = Record<string, unknown>> = M;

/**
 * Internal symbol used as a brand key for the HandlerPayload type.
 * Enables TypeScript to distinguish HandlerPayload from plain symbols.
 * @internal
 */
export const PayloadKey = Symbol("payload");

/**
 * Internal symbol used as a brand key for the DistributedPayload type.
 * Enables TypeScript to distinguish distributed actions from local actions.
 * @internal
 */
export const DistributedKey = Symbol("distributed");

/**
 * Branded type for action symbols created with `Action()`.
 * The phantom type parameter `T` carries the payload type at the type level.
 *
 * @template T - The payload type for the action
 */
export type HandlerPayload<T = unknown> = symbol & { [PayloadKey]: T };

/**
 * Branded type for distributed action symbols created with `Action()` and `Distribution.Broadcast`.
 * Distributed actions are broadcast to all mounted components and can be consumed with `actions.consume()`.
 *
 * This type extends `HandlerPayload<T>` with an additional brand to enforce at compile-time
 * that only distributed actions can be passed to `consume()`. Attempting to consume
 * a local action will result in a TypeScript error.
 *
 * @template T - The payload type for the action
 *
 * @example
 * ```ts
 * // This compiles - SignedOut is a distributed action
 * const SignedOut = Action<User>("SignedOut", Distribution.Broadcast);
 * actions.consume(SignedOut, (box) => <div>{box.value.name}</div>);
 *
 * // This fails to compile - Increment is a local action
 * const Increment = Action<number>("Increment");
 * actions.consume(Increment, ...); // Type error!
 * ```
 */
export type DistributedPayload<T = unknown> = HandlerPayload<T> & {
  [DistributedKey]: true;
};

/**
 * Extracts the payload type `T` from a `HandlerPayload<T>` or `ActionFilter<HandlerPayload<T>>`.
 * Use this in handler signatures to get the action's payload type.
 *
 * Works with both plain actions and filtered action tuples:
 * - `Payload<Action<User>>` → `User`
 * - `Payload<[Action<User>, { UserId: number }]>` → `User`
 *
 * @template A - The action type (HandlerPayload<T> or ActionFilter)
 */
export type Payload<A> = A extends readonly [HandlerPayload<infer P>, Filter]
  ? P
  : A extends HandlerPayload<infer P>
    ? P
    : never;

/**
 * JavaScript primitive types.
 * Includes all primitive values: `string`, `number`, `bigint`, `boolean`, `symbol`, `null`, and `undefined`.
 */
export type Primitive =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined;

/**
 * Non-nullable primitive type for filter values.
 * Includes `string`, `number`, `bigint`, `boolean`, and `symbol`.
 */
export type FilterValue = NonNullable<Primitive>;

/**
 * Filter object for channeled actions.
 * Must be an object where each value is a non-nullable primitive.
 *
 * By convention, use uppercase keys (e.g., `{UserId: 4}` not `{userId: 4}`)
 * to distinguish filter keys from payload properties.
 *
 * When dispatching, handlers are invoked if ALL properties in the dispatch filter
 * match the corresponding properties in the registered filter.
 *
 * @example
 * ```ts
 * // Register a handler for a specific user
 * actions.useAction([Actions.User, { UserId: 1 }], handler);
 *
 * // Dispatch matches if all dispatch properties match registered properties
 * dispatch([Actions.User, { UserId: 1 }], payload);              // Matches
 * dispatch([Actions.User, { UserId: 2 }], payload);              // No match
 * dispatch([Actions.User, { UserId: 1, Role: "admin" }], payload); // Matches
 * dispatch([Actions.User, {}], payload);                         // Matches all
 * dispatch(Actions.User, payload);                               // Matches ALL handlers
 * ```
 */
export type Filter = Record<string, FilterValue>;

/**
 * Tuple type for subscribing to filtered events within an action.
 * Used with `useAction` to listen for actions dispatched with matching filter properties.
 *
 * The filter is an object where dispatch properties must match registered properties:
 * - Register: `[Action, { UserId: 1, Role: "admin" }]`
 * - Dispatch `[Action, { UserId: 1 }]` → matches handlers where `UserId === 1`
 * - Dispatch `[Action, {}]` → matches ALL filtered handlers
 * - Dispatch `Action` (plain) → matches ALL handlers (plain + filtered)
 *
 * @template A - The action type (must be a HandlerPayload)
 *
 * @example
 * ```ts
 * class Actions {
 *   static UserUpdated = Action<User>("UserUpdated", Distribution.Broadcast);
 * }
 *
 * // Subscribe to updates for a specific user
 * actions.useAction([Actions.UserUpdated, { UserId: props.userId }], (context, user) => {
 *   context.actions.produce((draft) => {
 *     draft.model.user = user;
 *   });
 * });
 *
 * // Dispatch to specific user
 * actions.dispatch([Actions.UserUpdated, { UserId: user.id }], user);
 *
 * // Dispatch to ALL handlers (plain + filtered)
 * actions.dispatch(Actions.UserUpdated, user);
 * ```
 */
export type ActionFilter<A extends HandlerPayload = HandlerPayload> = readonly [
  A,
  Filter,
];

/**
 * Union type representing either a plain action or a filtered action tuple.
 * Used in `useAction` and `dispatch` signatures to accept both forms.
 *
 * @template A - The action type
 */
export type ActionOrFilter<A extends HandlerPayload = HandlerPayload> =
  | A
  | ActionFilter<A>;

/**
 * Checks if a function type returns a Promise.
 * @internal
 */
type IsAsync<F> = F extends (...args: unknown[]) => Promise<unknown>
  ? true
  : false;

/**
 * Type guard that produces a compile-time error if an async function is passed.
 * Used to enforce synchronous callbacks in `produce()`.
 * @internal
 */
type AssertSync<F> =
  IsAsync<F> extends true
    ? "Error: async functions are not allowed in produce"
    : F;

/**
 * Base type for data props passed to useActions.
 * Represents any object that can be captured as reactive data.
 */
export type Props = Record<string, unknown>;

/**
 * Constraint type for action containers.
 * Actions are symbols grouped in an object (typically a class with static properties).
 */
export type Actions = object;

/**
 * Helper type to extract the Model from an ActionPair tuple.
 * If T is a tuple [M, AC], returns M. Otherwise returns T directly.
 */
export type InferModel<T> = T extends [infer M, Actions] ? M : T;

/**
 * Helper type to extract the Actions from an ActionPair tuple.
 * If T is a tuple [M, AC], returns AC. Otherwise returns the Fallback.
 */
export type InferActions<T, Fallback = Actions> = T extends [Model, infer AC]
  ? AC
  : Fallback;

/**
 * Type alias for the [Model, Actions] tuple pattern.
 * Use this to define a single type that captures both model and actions.
 *
 * @example
 * ```ts
 * type Action = [Model, typeof Actions];
 * const handler = useAction<Action>((context) => { ... });
 * ```
 */
export type ActionPair = [Model, Actions];

/**
 * Internal result container for tracking Immertation processes during action execution.
 * @internal
 */
export type Result = {
  processes: Set<Process>;
};

export type HandlerContext<
  M extends Model,
  AC extends Actions,
  D extends Props = Props,
> = {
  readonly model: Readonly<M>;
  /**
   * The current lifecycle phase of the component.
   * Useful for determining if the handler was called during mount (e.g., from a cached
   * distributed action value) vs after the component is fully mounted.
   *
   * @example
   * ```ts
   * actions.useAction(DistributedActions.Counter, (context, payload) => {
   *   if (context.phase === Phase.Mounting) {
   *     // Called with cached value during mount
   *     console.log("Received cached value:", payload);
   *   }
   * });
   * ```
   */
  readonly phase: Phase;
  /**
   * The current task for the executing action handler.
   * Contains the AbortController, action identifier, and payload for this specific invocation.
   *
   * Use `task.controller.signal` to check if the action was aborted, or `task.controller.abort()` to cancel it.
   * The `task.action` and `task.payload` properties identify which action triggered this handler.
   *
   * @example
   * ```ts
   * actions.useAction(Actions.Fetch, async (context) => {
   *   const response = await fetch("/api", {
   *     signal: context.task.controller.signal,
   *   });
   *
   *   if (context.task.controller.signal.aborted) return;
   *
   *   context.actions.produce((draft) => {
   *     draft.model.data = response;
   *   });
   * });
   * ```
   */
  readonly task: Task;
  /**
   * Reactive data values passed to useActions.
   * Always returns the latest values, even after awaits in async handlers.
   *
   * @example
   * ```ts
   * const [name, setName] = useState("Adam");
   * const actions = useActions<Model, typeof Actions>(model, () => ({ name }));
   *
   * actions.useAction(Actions.Fetch, async (context) => {
   *   await fetch("/api");
   *   // context.data.name is always the latest value
   *   console.log(context.data.name);
   * });
   * ```
   */
  readonly data: D;
  /**
   * Set of all running tasks across all components in the context.
   * Tasks are ordered by creation time (oldest first).
   *
   * Each task contains:
   * - `controller`: The AbortController to cancel this task
   * - `action`: The action identifier that triggered this task
   * - `payload`: The payload passed when the action was dispatched
   *
   * @example
   * ```ts
   * // Abort all tasks for a specific action
   * for (const runningTask of context.tasks) {
   *   if (runningTask.action === Actions.Fetch) {
   *     runningTask.controller.abort();
   *   }
   * }
   *
   * // Abort the oldest task
   * const oldest = context.tasks.values().next().value;
   * oldest?.controller.abort();
   *
   * // Abort all tasks except the current one
   * for (const runningTask of context.tasks) {
   *   if (runningTask !== context.task) {
   *     runningTask.controller.abort();
   *   }
   * }
   * ```
   */
  readonly tasks: Tasks;
  readonly actions: {
    produce<
      F extends (draft: {
        model: M;
        readonly inspect: Readonly<Inspect<M>>;
      }) => void,
    >(
      ƒ: F & AssertSync<F>,
    ): M;
    dispatch<A extends AC[keyof AC] & HandlerPayload<unknown>>(
      ...args: [Payload<A>] extends [never] ? [A] : [A, Payload<A>]
    ): void;
    annotate<T>(operation: Operation, value: T): T;
  };
};

/**
 * Return type for the useActions hook.
 *
 * A tuple containing:
 * 1. The current model state of type M
 * 2. An actions object with dispatch, consume, and inspect capabilities
 *
 * @template M - The model type representing the component's state
 * @template AC - The actions class containing action definitions
 *
 * @example
 * ```tsx
 * const [model, actions] = useActions<typeof Actions>(initialModel);
 *
 * // Access state
 * model.count;
 *
 * // Dispatch actions
 * actions.dispatch(Actions.Increment, 5);
 *
 * // Consume action values declaratively
 * {actions.consume(Actions.Data, (box) => box.value.name)}
 *
 * // Check pending state
 * actions.inspect.count.pending();
 * ```
 */
/**
 * Utility type for defining a single action handler function.
 * Use this when you need to type a specific handler directly.
 *
 * @template M - The model type
 * @template AC - The actions class type
 * @template K - The action key (keyof AC) — determines payload type via lookup
 * @template D - Optional data/props type (defaults to Props)
 *
 * @see {@link HandlerMap} for the recommended HKT pattern
 */
export type Handler<
  M extends Model,
  AC extends Actions,
  K extends keyof AC,
  D extends Props = Props,
> = (
  context: HandlerContext<M, AC, D>,
  payload: Payload<AC[K] & HandlerPayload<unknown>>,
) => void | Promise<void> | AsyncGenerator | Generator;

/**
 * Higher-Kinded Type (HKT) emulation for action handlers.
 * Creates a mapped type where each action key maps to its fully-typed handler.
 *
 * TypeScript doesn't natively support HKTs (types that return types), but this
 * pattern emulates them using mapped types with indexed access.
 *
 * @template M - The model type
 * @template AC - The actions class type
 * @template D - Optional data/props type (defaults to Props)
 *
 * @example
 * ```ts
 * import { Action, HandlerMap } from "chizu";
 *
 * class Actions {
 *   static SetName = Action<string>("SetName");
 *   static SetAge = Action<number>("SetAge");
 * }
 *
 * // Define the HKT once for this module
 * type H = HandlerMap<Model, typeof Actions>;
 *
 * // "Apply" the HKT via indexed access — H["SetName"] is the handler type
 * export const handleSetName: H["SetName"] = (context, name) => {
 *   context.actions.produce((draft) => {
 *     draft.model.name = name;
 *   });
 * };
 *
 * export const handleSetAge: H["SetAge"] = (context, age) => {
 *   context.actions.produce((draft) => {
 *     draft.model.age = age;
 *   });
 * };
 *
 * // Use in component
 * export default function useUserActions() {
 *   const actions = useActions<Model, typeof Actions>(model);
 *   actions.useAction(Actions.SetName, handleSetName);
 *   actions.useAction(Actions.SetAge, handleSetAge);
 *   return actions;
 * }
 * ```
 */
export type HandlerMap<
  M extends Model,
  AC extends Actions,
  D extends Props = Props,
> = {
  [K in keyof AC]: (
    context: HandlerContext<M, AC, D>,
    payload: Payload<AC[K] & HandlerPayload<unknown>>,
  ) => void | Promise<void> | AsyncGenerator | Generator;
};

export type UseActions<
  M extends Model,
  AC extends Actions,
  D extends Props = Props,
> = [
  Readonly<M>,
  {
    dispatch(action: ActionOrFilter, payload?: HandlerPayload): void;
    /**
     * Subscribes to a distributed action's values and renders based on the callback.
     * The callback receives a Box with `value` (the payload) and `inspect` (for annotation status).
     * On mount, displays the most recent value from the Consumer store if available.
     *
     * Supports two usage patterns:
     * 1. Consuming actions from the local actions class (with autocomplete)
     * 2. Consuming any distributed action from external modules
     *
     * @param action - The distributed action to consume
     * @param renderer - Render function receiving the Box
     * @returns React element rendered by the callback
     *
     * @example
     * ```tsx
     * // Local action (from same actions class)
     * {actions.consume(Actions.Visitor, (visitor) =>
     *   visitor.inspect.pending() ? "Loading..." : visitor.value.name
     * )}
     *
     * // External distributed action
     * {actions.consume(SharedActions.Counter, (counter) => counter.value)}
     * ```
     */
    consume<T>(
      action: DistributedPayload<T>,
      renderer: ConsumerRenderer<T>,
    ): React.ReactNode;
    consume<K extends keyof AC>(
      action: AC[K] & DistributedPayload<unknown>,
      renderer: ConsumerRenderer<Payload<AC[K]>>,
    ): React.ReactNode;
    inspect: Inspect<M>;
  },
] & {
  /**
   * Registers an action handler with the current scope.
   * Types are pre-baked from the useActions call, so no type parameter is needed.
   *
   * Supports two subscription patterns:
   * 1. **Plain action** - Receives ALL dispatches for that action (including filtered ones)
   * 2. **Filtered action** `[Action, filter]` - Receives only dispatches matching the filter
   *
   * @param action - The action symbol or `[action, filter]` tuple to bind
   * @param handler - The handler function receiving context and payload
   *
   * @example
   * ```ts
   * const actions = useActions<typeof Actions>(model);
   *
   * // Subscribe to ALL UserUpdated events
   * actions.useAction(Actions.UserUpdated, (context, user) => {
   *   // Fires for any UserUpdated dispatch
   * });
   *
   * // Subscribe to UserUpdated for a specific user only
   * actions.useAction([Actions.UserUpdated, { UserId: props.userId }], (context, user) => {
   *   // Only fires when dispatched with matching filter
   * });
   * ```
   */
  useAction<A extends ActionId | ActionFilter>(
    action: A,
    handler: (
      context: HandlerContext<M, AC, D>,
      payload: Payload<A>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
};
