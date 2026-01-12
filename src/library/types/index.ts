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
  /** Triggered after the component renders (`useEffect`). */
  static Node = Symbol("chizu.action.lifecycle/Node");
  /** Triggered when the component unmounts. */
  static Unmount = Symbol("chizu.action.lifecycle/Unmount");
  /** Triggered when an action throws an error. Receives `Fault` as payload. */
  static Error = Symbol("chizu.action.lifecycle/Error");
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
 * Internal symbol used as a brand key for the Payload type.
 * Enables TypeScript to distinguish Payload from plain symbols.
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
 * Branded type for action payloads created with `createAction()`.
 * The phantom type parameter `T` carries the payload type at the type level.
 *
 * @template T - The payload type for the action
 */
export type Payload<T = unknown> = symbol & { [PayloadKey]: T };

/**
 * Branded type for distributed action payloads created with `createDistributedAction()`.
 * Distributed actions are broadcast to all mounted components and can be consumed with `actions.consume()`.
 *
 * This type extends `Payload<T>` with an additional brand to enforce at compile-time
 * that only distributed actions can be passed to `consume()`. Attempting to consume
 * a local action will result in a TypeScript error.
 *
 * @template T - The payload type for the action
 *
 * @example
 * ```ts
 * // This compiles - SignedOut is a distributed action
 * const SignedOut = createDistributedAction<User>("SignedOut");
 * actions.consume(SignedOut, (box) => <div>{box.value.name}</div>);
 *
 * // This fails to compile - Increment is a local action
 * const Increment = createAction<number>("Increment");
 * actions.consume(Increment, ...); // Type error!
 * ```
 */
export type DistributedPayload<T = unknown> = Payload<T> & {
  [DistributedKey]: true;
};

/**
 * Extracts the payload type from a Payload-branded symbol.
 * @internal
 */
type PayloadType<A> = A extends Payload<infer P> ? P : never;

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
 * Base type for snapshot props passed to useActions.
 * Represents any object that can be captured as a reactive snapshot.
 */
export type Props = Record<string, unknown>;

/**
 * Constraint type for action containers.
 * Actions are symbols grouped in an object (typically a class with static properties).
 *
 * @template AC - The shape of the actions object
 */
export type Actions<AC = Record<string, symbol>> = AC;

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

export type ReactiveInterface<
  M extends Model,
  AC extends Actions,
  S extends Props = Props,
> = {
  model: M;
  /**
   * The current task for the executing action handler.
   * Contains the AbortController, action identifier, and payload for this specific invocation.
   *
   * Use `task.task.signal` to check if the action was aborted, or `task.task.abort()` to cancel it.
   * The `task.action` and `task.payload` properties identify which action triggered this handler.
   *
   * @example
   * ```ts
   * actions.useAction(Actions.Fetch, async (context) => {
   *   const response = await fetch("/api", {
   *     signal: context.task.task.signal,
   *   });
   *
   *   if (context.task.task.signal.aborted) return;
   *
   *   context.actions.produce((draft) => {
   *     draft.model.data = response;
   *   });
   * });
   * ```
   */
  task: Task;
  /**
   * Snapshot of reactive values passed to useActions.
   * Always returns the latest values, even after awaits in async handlers.
   *
   * @example
   * ```ts
   * const [name, setName] = useState("Adam");
   * const actions = useActions<Model, typeof Actions>(model, () => ({ name }));
   *
   * actions.useAction(Actions.Fetch, async (context) => {
   *   await fetch("/api");
   *   // context.snapshot.name is always the latest value
   *   console.log(context.snapshot.name);
   * });
   * ```
   */
  snapshot: S;
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
   *     runningTask.task.abort();
   *   }
   * }
   *
   * // Abort the oldest task
   * const oldest = context.tasks.values().next().value;
   * oldest?.task.abort();
   *
   * // Abort all tasks except the current one
   * for (const runningTask of context.tasks) {
   *   if (runningTask !== context.task) {
   *     runningTask.task.abort();
   *   }
   * }
   * ```
   */
  tasks: Tasks;
  actions: {
    produce<F extends (draft: { model: M; inspect: Inspect<M> }) => void>(
      ƒ: F & AssertSync<F>,
    ): M;
    dispatch<A extends AC[keyof AC] & Payload<unknown>>(
      ...args: [PayloadType<A>] extends [never] ? [A] : [A, PayloadType<A>]
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
 * Helper type to extract payload type from an action symbol.
 * If the action is Payload<T>, returns T. Otherwise returns never.
 */
export type ExtractPayload<A> = A extends Payload<infer P> ? P : never;

/**
 * Utility type for defining action handler functions.
 * Use this when defining handlers in separate files that will be passed to useAction.
 *
 * Similar to how React exports `React.FC` for typing functional components,
 * `Handler` provides full type safety for action handlers.
 *
 * @template M - The model type
 * @template AC - The actions class type
 * @template A - The specific action type (determines payload type)
 * @template S - Optional snapshot/props type (defaults to Props)
 *
 * @example
 * ```ts
 * import { Action, Handler } from "chizu";
 *
 * // Create actions with the Action factory
 * class Actions {
 *   static Name = Action<string>("Name");
 * }
 *
 * // Define handler externally with full type inference
 * const nameHandler: Handler<Model, typeof Actions, typeof Actions["Name"]> =
 *   (context, name) => {
 *     context.actions.produce((draft) => {
 *       draft.model.name = name;
 *     });
 *   };
 *
 * // Use in component
 * export default function useNameActions() {
 *   const actions = useActions<Model, typeof Actions>(model);
 *   actions.useAction(Actions.Name, nameHandler);
 *   return actions;
 * }
 * ```
 */
export type Handler<
  M extends Model,
  AC extends Actions,
  A extends Payload<unknown>,
  S extends Props = Props,
> = (
  context: ReactiveInterface<M, AC, S>,
  payload: ExtractPayload<A>,
) => void | Promise<void> | AsyncGenerator | Generator;

export type UseActions<
  M extends Model,
  AC extends Actions,
  S extends Props = Props,
> = [
  M,
  {
    dispatch(action: ActionId, payload?: Payload): void;
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
      renderer: ConsumerRenderer<PayloadType<AC[K]>>,
    ): React.ReactNode;
    inspect: Inspect<M>;
  },
] & {
  /**
   * Registers an action handler with the current scope.
   * Types are pre-baked from the useActions call, so no type parameter is needed.
   *
   * @param action - The action symbol to bind (e.g., Lifecycle.Mount, Actions.Visitor)
   * @param handler - The handler function receiving context and optional payload
   *
   * @example
   * ```ts
   * const actions = useActions<typeof Actions>(model);
   *
   * actions.useAction(Lifecycle.Mount, (context) => {
   *   // Setup logic
   * });
   *
   * actions.useAction(Actions.Visitor, (context, country) => {
   *   context.actions.produce((draft) => {
   *     draft.model.visitor = country;
   *   });
   * });
   * ```
   */
  useAction<A extends ActionId>(
    action: A,
    handler: (
      context: ReactiveInterface<M, AC, S>,
      payload: ExtractPayload<A>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
};
