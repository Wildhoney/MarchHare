import { Operation } from "immertation";
import { Process, Inspect, Box } from "immertation";
import type { Regulator } from "../regulator/index.js";
import type { Action } from "../regulator/types.ts";
import type { ConsumerRenderer } from "../consumer/index.tsx";
import type * as React from "react";

export type { Action, Box };
export type { ConsumerRenderer };

export const context = Symbol("chizu.action.context");

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
  /** Triggered when an action throws an error. Receives `ErrorDetails` as payload. */
  static Error = Symbol("chizu.action.lifecycle/Error");
}

/**
 * Status enum for controlling poll behavior.
 * Use with `@use.poll()` to pause and resume polling.
 *
 * @example
 * ```ts
 * const [isPaused, setIsPaused] = useState(false);
 *
 * class {
 *   @use.poll(5000, () => ({ userId }), () => isPaused ? Status.Pause : Status.Play)
 *   [Actions.RefreshData] = refreshAction;
 * }
 * ```
 */
export enum Status {
  /** Polling is active and will continue at the specified interval. */
  Play = "play",
  /** Polling is paused and will not execute until status returns to Play. */
  Pause = "pause",
}

/**
 * Abort modes for controlling which actions to abort.
 *
 * @example
 * ```ts
 * // Abort only the current action instance (default)
 * context.abort();
 * context.abort(Abort.Self);
 *
 * // Abort all instances of a named action
 * context.abort(Abort.Named, Actions.Increment);
 *
 * // Abort all actions globally
 * context.abort(Abort.All);
 * ```
 */
export enum Abort {
  /** Abort all instances of a named action (local or distributed). */
  Action = "action",
  /** Abort all actions globally. */
  Everything = "everything",
}

export type Pk<T> = undefined | symbol | T;

export type Task = PromiseWithResolvers<void>;

export type Model<M = Record<string, unknown>> = M;

export const PayloadKey = Symbol("payload");

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

type PayloadType<A> = A extends Payload<infer P> ? P : never;

type IsAsync<F> = F extends (...args: unknown[]) => Promise<unknown>
  ? true
  : false;

type AssertSync<F> =
  IsAsync<F> extends true
    ? "Error: async functions are not allowed in produce"
    : F;

type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type Props = Record<string, unknown>;

export type ActionsClass<AC = object> = {
  new (): unknown;
} & AC;

/**
 * Helper type to extract the Model from an ActionPair tuple.
 * If T is a tuple [M, AC], returns M. Otherwise returns T directly.
 */
export type InferModel<T> = T extends [infer M, ActionsClass] ? M : T;

/**
 * Helper type to extract the ActionsClass from an ActionPair tuple.
 * If T is a tuple [M, AC], returns AC. Otherwise returns the Fallback.
 */
export type InferActionsClass<T, Fallback = ActionsClass> = T extends [
  Model,
  infer AC,
]
  ? AC
  : Fallback;

/**
 * Type alias for the [Model, ActionsClass] tuple pattern.
 * Use this to define a single type that captures both model and actions.
 *
 * @example
 * ```ts
 * type Action = [Model, typeof Actions];
 * const handler = useAction<Action>((context) => { ... });
 * ```
 */
export type ActionPair = [Model, ActionsClass];

export type ActionInstance<
  M extends Model,
  AC extends ActionsClass,
> = UnionToIntersection<
  AC[keyof AC] extends infer P
    ? P extends symbol
      ? P extends Payload<infer T>
        ? {
            [K in P]: ((
              context: Context<M, AC>,
              payload: T,
            ) => void | Promise<void>) & {
              payload: T;
            };
          }
        : never
      : never
    : never
>;

export type Result = {
  processes: Set<Process>;
};

export type OperationFunction = <T>(value: T, process: Process) => T;

export type Context<M extends Model, AC extends ActionsClass> = {
  model: M;
  signal: AbortSignal;
  regulator: {
    abort: Regulator["abort"] & { self(): void };
    policy: {
      allow: Regulator["policy"]["allow"] & { self(): void };
      disallow: Regulator["policy"]["disallow"] & { self(): void };
    };
  };
  /**
   * Abort actions based on the specified mode.
   *
   * @param mode The abort mode (defaults to `Abort.Self` if not specified).
   * @param action Required when mode is `Abort.Named` - the action to abort.
   *
   * @example
   * ```ts
   * context.abort();                            // Abort current action instance
   * context.abort(Abort.Self);                  // Same as above
   * context.abort(Abort.Named, Actions.Fetch);  // Abort all instances of Fetch
   * context.abort(Abort.All);                   // Abort ALL actions globally
   * ```
   */
  actions: {
    produce<F extends (draft: { model: M; inspect: Inspect<M> }) => void>(
      ƒ: F & AssertSync<F>,
    ): M;
    dispatch<A extends AC[keyof AC] & Payload<unknown>>(
      ...args: [PayloadType<A>] extends [never] ? [A] : [A, PayloadType<A>]
    ): void;
    annotate<T>(operation: Operation, value: T): T;
  };
  [context]: {
    controller: AbortController;
  };
};

export type Actions<
  M extends Model,
  AC extends ActionsClass,
> = new () => ActionInstance<M, AC>;

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
 * const [model, actions] = useActions<Model, typeof Actions>(initialModel, Actions);
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
export type UseActions<M extends Model, AC extends ActionsClass> = [
  M,
  {
    dispatch(action: Action, payload?: Payload): void;
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
];
