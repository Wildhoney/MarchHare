import * as React from "react";
import { Operation } from "immertation";
import { Process, Inspect, Box } from "immertation";
import type {
  ActionId,
  Task,
  Tasks,
} from "../boundary/components/tasks/types.ts";
import type { Option } from "@mobily/ts-belt/Option";
import type { Result as TsBeltResult } from "@mobily/ts-belt/Result";
import type { Regulator } from "../boundary/components/regulators/types.ts";
import type { Fault } from "../error/types.ts";

export type { ActionId, Box, Task, Tasks };
/**
 * Type for objects with a Brand.Action symbol property.
 * Used for type-safe access to the action symbol.
 */
export type BrandedAction = { readonly [K in typeof Brand.Action]: symbol };

/**
 * Type for objects with a Brand.Broadcast symbol property.
 * Used for type-safe access to the broadcast flag.
 */
export type BrandedBroadcast = {
  readonly [K in typeof Brand.Broadcast]: boolean;
};

/**
 * Type for objects with a Brand.Multicast symbol property.
 * Used for type-safe access to the multicast flag.
 */
export type BrandedMulticast = {
  readonly [K in typeof Brand.Multicast]: boolean;
};

/**
 * Base type for any object that may contain branded symbol properties.
 * Used as a permissive input type for action utilities.
 */
export type BrandedObject = { readonly [x: symbol]: unknown };

/**
 * Union type representing any valid action that can be passed to action utilities.
 * This includes raw ActionIds (symbol/string), and any branded object.
 */
export type AnyAction = ActionId | BrandedObject;

/**
 * Internal symbols used as brand keys to distinguish typed objects at runtime.
 * These enable TypeScript to differentiate between HandlerPayload, BroadcastPayload,
 * and channeled actions through branded types.
 * @internal
 */
export class Brand {
  /** Brand key for HandlerPayload type */
  static readonly Payload = Symbol("chizu.brand/Payload");
  /** Brand key for BroadcastPayload type */
  static readonly Broadcast = Symbol("chizu.brand/Broadcast");
  /** Brand key for MulticastPayload type */
  static readonly Multicast = Symbol("chizu.brand/Multicast");
  /** Access the underlying symbol from an action */
  static readonly Action = Symbol("chizu.brand/Action");
  /** Identifies channeled actions (result of calling Action(channel)) */
  static readonly Channel = Symbol("chizu.brand/Channel");
  /** Node capture events used by Lifecycle.Node */
  static readonly Node = Symbol("chizu.action.lifecycle/Node");
  /** Identifies cache entry identifiers created with Entry() */
  static readonly Cache = Symbol("chizu.brand/Cache");
}

/**
 * Phantom brand symbol for value type tracking on cache entry identifiers.
 * Uses a function type `(t: T) => T` to enforce invariance, preventing
 * a cache entry declared for one type from being used with a different type.
 * @internal
 */
declare const CacheValueBrand: unique symbol;

/**
 * A branded cache entry identifier.
 *
 * When the second type parameter `C` is provided, the entry becomes callable
 * to produce channeled identifiers for independent cache slots per channel.
 *
 * @template T - The cached value type.
 * @template C - The channel type for channeled entries (defaults to never).
 */
export type CacheId<T = unknown, C extends Filter = never> = {
  readonly [Brand.Cache]: symbol;
  readonly [CacheValueBrand]?: (t: T) => T;
} & ([C] extends [never]
  ? unknown
  : {
      (channel: C): ChanneledCacheId<T, C>;
    });

/**
 * Result of calling a channeled cache entry with a channel argument.
 * Contains the entry identity and the channel data for scoped cache access.
 *
 * @template T - The cached value type.
 * @template C - The channel type.
 */
export type ChanneledCacheId<T = unknown, C = unknown> = {
  readonly [Brand.Cache]: symbol;
  readonly [CacheValueBrand]?: (t: T) => T;
  readonly channel: C;
};

/**
 * Creates a lifecycle action with the given name.
 * Produces a branded `HandlerPayload` backed by a fresh
 * `Symbol("chizu.action.lifecycle/${name}")` on each call.
 *
 * @internal
 */
function createLifecycleAction<P = never, C extends Filter = never>(
  name: string,
): HandlerPayload<P, C> {
  const symbol = Symbol(`chizu.action.lifecycle/${name}`);
  const action = function (channel: C): ChanneledAction<P, C> {
    return {
      [Brand.Action]: symbol,
      [Brand.Payload]: <P>undefined,
      [Brand.Channel]: channel,
      channel,
    };
  };
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Action, {
    value: symbol,
    enumerable: false,
  });
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Payload, {
    value: undefined,
    enumerable: false,
  });
  return <HandlerPayload<P, C>>action;
}

/**
 * Factory functions for lifecycle actions.
 *
 * Each call returns a **unique** action symbol, enabling per-component
 * regulation. Assign the result as a static property in your Actions class:
 *
 * @example
 * ```ts
 * export class Actions {
 *   static Mount = Lifecycle.Mount();
 *   static Unmount = Lifecycle.Unmount();
 *   static Error = Lifecycle.Error();
 *   static Update = Lifecycle.Update();
 *   static Node = Lifecycle.Node();
 *
 *   static Increment = Action("Increment");
 * }
 *
 * // Now regulating Lifecycle.Mount only blocks THIS component's mount:
 * context.regulator.disallow(Actions.Mount);
 * ```
 */
export class Lifecycle {
  /** Creates a Mount lifecycle action. Triggered once on component mount (`useLayoutEffect`). */
  static Mount(): HandlerPayload<never> {
    return createLifecycleAction("Mount");
  }

  /** Creates an Unmount lifecycle action. Triggered when the component unmounts. */
  static Unmount(): HandlerPayload<never> {
    return createLifecycleAction("Unmount");
  }

  /** Creates an Error lifecycle action. Triggered when an action throws. Receives `Fault` as payload. */
  static Error(): HandlerPayload<Fault> {
    return createLifecycleAction<Fault>("Error");
  }

  /** Creates an Update lifecycle action. Triggered when `context.data` changes (not on initial mount). */
  static Update(): HandlerPayload<Record<string, unknown>> {
    return createLifecycleAction<Record<string, unknown>>("Update");
  }

  /**
   * Creates a Node lifecycle action. Triggered when a DOM node is captured
   * or released via `actions.node()`. Supports channeled subscriptions by
   * node name.
   *
   * @example
   * ```ts
   * export class Actions {
   *   static Node = Lifecycle.Node();
   * }
   *
   * // Subscribe to ALL node changes
   * actions.useAction(Actions.Node, (context, node) => {
   *   console.log("Node changed:", node);
   * });
   *
   * // Subscribe to a specific node by name (channeled)
   * actions.useAction(Actions.Node({ Name: "input" }), (context, node) => {
   *   if (node) node.focus();
   * });
   * ```
   */
  static Node(): HandlerPayload<unknown, { Name: string }> {
    return createLifecycleAction<unknown, { Name: string }>("Node");
  }
}

/**
 * Distribution modes for actions.
 *
 * - **Unicast** &ndash; Action is scoped to the component that defines it and cannot be
 *   consumed by other components. This is the default behaviour.
 * - **Broadcast** &ndash; Action is distributed to all mounted components that have defined
 *   a handler for it. Values are cached for late-mounting components.
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
  /** Action is multicast to all components within a named scope boundary. */
  Multicast = "multicast",
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
 * Operations for toggling boolean feature flags via `actions.feature()`.
 *
 * @example
 * ```ts
 * actions.feature("sidebar", Feature.Toggle);
 * actions.feature("sidebar", Feature.On);
 * actions.feature("sidebar", Feature.Off);
 * ```
 */
export enum Feature {
  /** Sets the feature to `true`. */
  On = "on",
  /** Sets the feature to `false`. */
  Off = "off",
  /** Inverts the current boolean value. */
  Toggle = "toggle",
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
 * Branded type for action objects created with `Action()`.
 * The phantom type parameters carry the payload and channel types at the type level.
 *
 * Actions wrap an internal symbol (used as event emitter keys) in a callable object.
 * When a channel type is specified, the action can be called to create a channeled dispatch.
 *
 * @template P - The payload type for the action
 * @template C - The channel type for channeled dispatches (defaults to never = no channel)
 *
 * @example
 * ```ts
 * // Action without channel support
 * const Increment = Action<number>("Increment");
 * dispatch(Increment, 5);
 *
 * // Action with channel support
 * const UserUpdated = Action<User, { UserId: number }>("UserUpdated");
 * dispatch(UserUpdated, user);                    // broadcast to all handlers
 * dispatch(UserUpdated({ UserId: 5 }), user);     // channeled dispatch
 * ```
 */
export type HandlerPayload<P = unknown, C extends Filter = never> = {
  readonly [Brand.Action]: symbol;
  readonly [Brand.Payload]: P;
  readonly [Brand.Broadcast]?: boolean;
} & ([C] extends [never]
  ? unknown
  : {
      (channel: C): ChanneledAction<P, C>;
    });

/**
 * Result of calling an action with a channel argument.
 * Contains the action reference and the channel data for filtered dispatch.
 *
 * @template P - The payload type for the action
 * @template C - The channel type
 *
 * @example
 * ```ts
 * const UserUpdated = Action<User, { UserId: number }>("UserUpdated");
 *
 * // UserUpdated({ UserId: 5 }) returns ChanneledAction<User, { UserId: number }>
 * dispatch(UserUpdated({ UserId: 5 }), user);
 * ```
 */
export type ChanneledAction<P = unknown, C = unknown> = {
  readonly [Brand.Action]: symbol;
  readonly [Brand.Payload]: P;
  readonly [Brand.Channel]: C;
  readonly channel: C;
};

/**
 * Branded type for broadcast action objects created with `Action()` and `Distribution.Broadcast`.
 * Broadcast actions are sent to all mounted components. Values are cached so that
 * late-mounting components receive the most recent payload.
 *
 * This type extends `HandlerPayload<P, C>` with an additional brand to enforce at compile-time
 * that only broadcast actions can be passed to `context.actions.read()`.
 *
 * @template P - The payload type for the action
 * @template C - The channel type for channeled dispatches (defaults to never)
 *
 * @example
 * ```ts
 * const SignedOut = Action<User>("SignedOut", Distribution.Broadcast);
 *
 * // Read the latest value inside a handler
 * const user = await context.actions.read(SignedOut);
 * ```
 */
export type BroadcastPayload<
  P = unknown,
  C extends Filter = never,
> = HandlerPayload<P, C> & {
  readonly [Brand.Broadcast]: true;
};

/**
 * Branded type for multicast action objects created with `Action()` and `Distribution.Multicast`.
 * Multicast actions are dispatched to all components within a named scope boundary.
 *
 * When dispatching a multicast action, you MUST provide the scope name as the third argument:
 * ```ts
 * actions.dispatch(Actions.Multicast.Update, payload, { scope: "MyScope" });
 * ```
 *
 * Components receive multicast events only if they are descendants of a `<Scope name="...">`.
 *
 * @template P - The payload type for the action
 * @template C - The channel type for channeled dispatches (defaults to never)
 *
 * @example
 * ```tsx
 * // Define multicast actions in a shared class
 * class MulticastActions {
 *   static Update = Action<number>("Update", Distribution.Multicast);
 * }
 *
 * // Reference from component-level Actions
 * class Actions {
 *   static Multicast = MulticastActions;
 * }
 *
 * // In JSX - create a named scope boundary
 * <Scope name="Counter">
 *   <CounterA />
 *   <CounterB />
 * </Scope>
 *
 * // Inside CounterA - dispatch to all components in "Counter" scope
 * actions.dispatch(Actions.Multicast.Update, 42, { scope: "Counter" });
 * // CounterA and CounterB both receive the event
 * ```
 */
export type MulticastPayload<
  P = unknown,
  C extends Filter = never,
> = HandlerPayload<P, C> & {
  readonly [Brand.Multicast]: true;
};

/**
 * Options for multicast dispatch.
 * Required when dispatching a multicast action.
 */
export type MulticastOptions = {
  /** The name of the scope to multicast to. Must match a `<Scope name="...">` ancestor. */
  scope: string;
};

/**
 * Extracts the payload type `P` from a `HandlerPayload<P>` or `ChanneledAction<P, C>`.
 * Use this in handler signatures to get the action's payload type.
 *
 * Works with both plain actions and channeled actions:
 * - `Payload<Action<User>>` → `User`
 * - `Payload<ChanneledAction<User, { UserId: number }>>` → `User`
 *
 * @template A - The action type (HandlerPayload or ChanneledAction)
 */

export type Payload<A> = A extends { readonly [Brand.Payload]: infer P }
  ? P
  : never;

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
export type Filter = Record<
  string,
  string | number | bigint | boolean | symbol
>;

/**
 * Union type representing either a plain action or a channeled action.
 * Used in `useAction` and `dispatch` signatures to accept both forms.
 *
 * @template A - The action type
 *
 * @example
 * ```ts
 * class Actions {
 *   static UserUpdated = Action<User, { UserId: number }>("UserUpdated", Distribution.Broadcast);
 * }
 *
 * // Subscribe to updates for a specific user (channeled)
 * actions.useAction(Actions.UserUpdated({ UserId: props.userId }), (context, user) => {
 *   context.actions.produce((draft) => {
 *     draft.model.user = user;
 *   });
 * });
 *
 * // Dispatch to specific user (channeled)
 * actions.dispatch(Actions.UserUpdated({ UserId: user.id }), user);
 *
 * // Dispatch to ALL handlers (plain)
 * actions.dispatch(Actions.UserUpdated, user);
 * ```
 */
export type ActionOrChanneled<A extends HandlerPayload = HandlerPayload> =
  | A
  | ChanneledAction;

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
 * Extracts the nodes type from a Model.
 * If the model has a `nodes` property, returns its type.
 * Otherwise returns an empty record.
 *
 * @example
 * ```ts
 * type Model = {
 *   count: number;
 *   nodes: { button: HTMLButtonElement | null };
 * };
 *
 * type N = Nodes<Model>; // { button: HTMLButtonElement | null }
 * ```
 */
export type Nodes<M> = M extends {
  nodes: infer N extends Record<string, unknown>;
}
  ? N
  : Record<never, unknown>;

/**
 * Extracts the `features` property from a Model type.
 * If the model has a `features` property whose values are all booleans,
 * returns its type. Otherwise returns an empty record, making the
 * `feature()` method effectively uncallable.
 *
 * @example
 * ```ts
 * enum Feature { Sidebar = 'Sidebar', Modal = 'Modal' }
 * type Model = { count: number; features: { [K in Feature]: boolean } };
 * type F = Features<Model>; // { Sidebar: boolean; Modal: boolean }
 * ```
 */
export type FeatureFlags<M> = M extends {
  features: infer F extends Record<string, boolean>;
}
  ? F
  : Record<never, boolean>;

/**
 * Constraint type for action containers.
 * Actions are symbols grouped in an object (typically a class with static properties).
 */
export type Actions = object;

/**
 * Internal result container for tracking Immertation processes during action execution.
 * @internal
 */
export type Result = {
  processes: Set<Process>;
};

export type HandlerContext<
  M extends Model | void,
  _AC extends Actions | void,
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
   * actions.useAction(Actions.Broadcast.Counter, (context, payload) => {
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
  readonly tasks: ReadonlySet<Task>;
  /**
   * Captured DOM nodes registered via `actions.node()`.
   * Nodes may be `null` if not yet captured or if the node was unmounted.
   *
   * @example
   * ```ts
   * actions.useAction(Actions.Focus, (context) => {
   *   context.nodes.input?.focus();
   * });
   * ```
   */
  readonly nodes: {
    [K in keyof Nodes<M>]: Nodes<M>[K] | null;
  };
  /**
   * The regulator API for controlling which actions may be dispatched.
   *
   * Each call replaces the previous policy entirely (last-write-wins).
   * The policy is shared across all components within the same `<Boundary>`.
   *
   * @example
   * ```ts
   * actions.useAction(Actions.Mount, (context) => {
   *   // Block all actions except Critical
   *   context.regulator.allow(Actions.Critical);
   * });
   *
   * actions.useAction(Actions.Unlock, (context) => {
   *   // Re-allow all actions
   *   context.regulator.allow();
   * });
   * ```
   */
  readonly regulator: Regulator;
  readonly actions: {
    produce<
      F extends (draft: {
        model: M;
        readonly inspect: Readonly<Inspect<M>>;
      }) => void,
    >(
      ƒ: F & AssertSync<F>,
    ): void;
    dispatch(
      action: ActionOrChanneled,
      payload?: unknown,
      options?: MulticastOptions,
    ): Promise<void>;
    annotate<T>(operation: Operation, value: T): T;
    /**
     * Fetches a value from the cache or executes the callback if not cached / expired.
     *
     * The callback must return an `Option<T>` or `Result<T, E>`. Only `Some` / `Ok`
     * values are stored; `None` / `Error` results are skipped and `{ data: null }`
     * is returned. Exactly one layer of `Option` / `Result` is unwrapped.
     *
     * @param entry - The cache entry identifier (from `Entry()`).
     * @param ttl - Time-to-live in milliseconds.
     * @param fn - Async callback that produces the value to cache.
     * @returns An object with `data` set to the cached or freshly-fetched value, or `null`.
     *
     * @example
     * ```ts
     * const { data } = await context.actions.cacheable(
     *   CacheStore.Pairs,
     *   30_000,
     *   async () => Some(await api.fetchPairs()),
     * );
     * ```
     */
    cacheable<T>(
      entry: CacheId<T> | ChanneledCacheId<T>,
      ttl: number,
      fn: () => Promise<Option<T>>,
    ): Promise<{ data: T | null }>;
    cacheable<T>(
      entry: CacheId<T> | ChanneledCacheId<T>,
      ttl: number,
      fn: () => Promise<TsBeltResult<T, unknown>>,
    ): Promise<{ data: T | null }>;
    /**
     * Removes a cached value from the store.
     *
     * @param entry - The cache entry identifier to invalidate.
     *
     * @example
     * ```ts
     * context.actions.invalidate(CacheStore.Pairs);
     * context.actions.invalidate(CacheStore.User({ UserId: 5 }));
     * ```
     */
    invalidate(entry: CacheId<unknown> | ChanneledCacheId<unknown>): void;
    /**
     * Mutates a boolean feature flag on the model and triggers a re-render.
     *
     * Requires the model to have a `features` property whose keys are the feature names.
     * Read feature state from `model.features` directly.
     *
     * @example
     * ```ts
     * context.actions.feature(Feature.Sidebar, Feature.Toggle);
     * context.actions.feature(Feature.Sidebar, Feature.Off);
     * ```
     */
    feature<K extends keyof FeatureFlags<M>>(name: K, operation: Feature): void;
    /**
     * Reads the latest broadcast or multicast value, waiting for annotations to settle.
     *
     * If a value has already been dispatched it resolves immediately.
     * Otherwise it waits until the next dispatch of the action.
     * Resolves with `null` if the task is aborted before a value arrives.
     *
     * @param action - The broadcast or multicast action to read.
     * @param options - For multicast actions, must include `{ scope: "ScopeName" }`.
     * @returns The dispatched value, or `null` if aborted.
     *
     * @example
     * ```ts
     * actions.useAction(Actions.FetchPosts, async (context) => {
     *   const user = await context.actions.read(Actions.Broadcast.User);
     *   if (!user) return;
     *   const posts = await fetchPosts(user.id, {
     *     signal: context.task.controller.signal,
     *   });
     *   context.actions.produce(({ model }) => { model.posts = posts; });
     * });
     * ```
     */
    read<T>(action: BroadcastPayload<T>): Promise<T | null>;
    read<T>(
      action: MulticastPayload<T>,
      options: MulticastOptions,
    ): Promise<T | null>;

    /**
     * Returns the latest broadcast or multicast value immediately without
     * waiting for annotations to settle. Use this when you need the current
     * cached value and do not need to wait for pending operations to complete.
     *
     * @param action - The broadcast or multicast action to peek at.
     * @param options - For multicast actions, must include `{ scope: "ScopeName" }`.
     * @returns The cached value, or `null` if no value has been dispatched.
     *
     * @example
     * ```ts
     * actions.useAction(Actions.Check, (context) => {
     *   const user = context.actions.peek(Actions.Broadcast.User);
     *   if (!user) return;
     *   console.log(user.name);
     * });
     * ```
     */
    peek<T>(action: BroadcastPayload<T>): T | null;
    peek<T>(action: MulticastPayload<T>, options: MulticastOptions): T | null;
  };
};

/**
 * Return type for the useActions hook.
 *
 * A tuple containing:
 * 1. The current model state of type M
 * 2. An actions object with dispatch and inspect capabilities
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
 * @see {@link Handlers} for the recommended HKT pattern
 */
export type Handler<
  M extends Model | void,
  AC extends Actions | void,
  K extends keyof AC & string,
  D extends Props = Props,
> = (
  context: HandlerContext<M, AC, D>,
  ...args: [Payload<AC[K] & HandlerPayload<unknown>>] extends [never]
    ? []
    : [payload: Payload<AC[K] & HandlerPayload<unknown>>]
) => void | Promise<void> | AsyncGenerator | Generator;

/**
 * String keys of `AC` excluding inherited `prototype` from class constructors.
 * When action containers are classes (`typeof MyActions`), TypeScript includes
 * `"prototype"` in `keyof`. Excluding it prevents `prototype` from appearing
 * as a handler key and avoids recursion into Function internals.
 */
type OwnKeys<AC> = Exclude<keyof AC & string, "prototype">;

/**
 * Recursive mapped type for action handlers that mirrors the action class hierarchy.
 *
 * For leaf actions (values with no own string keys, i.e. `HandlerPayload`), produces
 * a handler function signature. For namespace objects (containing nested actions),
 * produces a nested `Handlers` object.
 *
 * Access handlers using bracket notation matching the action structure:
 *
 * @template M - The model type
 * @template AC - The actions class type
 * @template D - Optional data/props type (defaults to Props)
 *
 * @example
 * ```ts
 * import { Action, Distribution, Handlers } from "chizu";
 *
 * class BroadcastActions {
 *   static PaymentSent = Action("PaymentSent", Distribution.Broadcast);
 *   static PaymentLink = Action<PaymentLinkData>("PaymentLink", Distribution.Broadcast);
 * }
 *
 * class Actions {
 *   static SetName = Action<string>("SetName");
 *   static Broadcast = BroadcastActions;
 * }
 *
 * type H = Handlers<Model, typeof Actions>;
 *
 * // Flat actions
 * export const handleSetName: H["SetName"] = (context, name) => { ... };
 *
 * // Nested actions use chained bracket notation
 * export const handlePaymentSent: H["Broadcast"]["PaymentSent"] = (context) => { ... };
 * ```
 */
export type Handlers<
  M extends Model | void,
  AC extends Actions | void,
  D extends Props = Props,
> = {
  [K in OwnKeys<AC>]: OwnKeys<AC[K]> extends never
    ? (
        context: HandlerContext<M, AC, D>,
        ...args: [Payload<AC[K] & HandlerPayload<unknown>>] extends [never]
          ? []
          : [payload: Payload<AC[K] & HandlerPayload<unknown>>]
      ) => void | Promise<void> | AsyncGenerator | Generator
    : Handlers<M, AC[K] & Actions, D>;
};

export type UseActions<
  M extends Model | void,
  AC extends Actions | void,
  D extends Props = Props,
> = [
  Readonly<M>,
  {
    /**
     * Dispatches an action with an optional payload.
     *
     * For multicast actions, you MUST provide the scope as the third argument:
     * ```ts
     * actions.dispatch(Actions.Multicast.Update, payload, { scope: "MyScope" });
     * ```
     *
     * @param action - The action to dispatch
     * @param payload - The payload to send with the action
     * @param options - For multicast actions, must include `{ scope: "ScopeName" }`
     */
    dispatch<P>(
      action: HandlerPayload<P>,
      payload?: P,
      options?: MulticastOptions,
    ): Promise<void>;
    dispatch<P>(
      action: BroadcastPayload<P>,
      payload?: P,
      options?: MulticastOptions,
    ): Promise<void>;
    dispatch<P>(
      action: MulticastPayload<P>,
      payload: P,
      options: MulticastOptions,
    ): Promise<void>;
    dispatch<P, C extends Filter>(
      action: ChanneledAction<P, C>,
      payload?: P,
      options?: MulticastOptions,
    ): Promise<void>;
    inspect: Inspect<M>;
    /**
     * Captured DOM nodes registered via `node()`.
     * Nodes may be `null` if not yet captured or if the node was unmounted.
     *
     * @example
     * ```tsx
     * type Model = {
     *   count: number;
     *   nodes: { input: HTMLInputElement };
     * };
     * const [model, actions] = useActions<Model, typeof Actions>(model);
     *
     * // Access captured nodes
     * actions.nodes.input?.focus();
     * ```
     */
    nodes: { [K in keyof Nodes<M>]: Nodes<M>[K] | null };
    /**
     * Captures a DOM node for later access via `nodes` or `context.nodes`.
     * Use as a ref callback on JSX nodes.
     *
     * @param name - The node key (must match a key in Model['nodes'])
     * @param node - The DOM node or null (when unmounting)
     *
     * @example
     * ```tsx
     * type Model = {
     *   count: number;
     *   nodes: {
     *     container: HTMLDivElement;
     *     input: HTMLInputElement;
     *   };
     * };
     *
     * const [model, actions] = useActions<Model, typeof Actions>(model);
     *
     * return (
     *   <div ref={node => actions.node('container', node)}>
     *     <input ref={node => actions.node('input', node)} />
     *   </div>
     * );
     * ```
     */
    node<K extends keyof Nodes<M>>(name: K, node: Nodes<M>[K] | null): void;
    /**
     * Mutates a boolean feature flag on the model and triggers a re-render.
     *
     * Read feature state from `model.features` directly.
     *
     * @example
     * ```tsx
     * actions.feature(Feature.Sidebar, Feature.Toggle);
     *
     * {model.features.Sidebar && <Sidebar />}
     * ```
     */
    feature<K extends keyof FeatureFlags<M>>(name: K, operation: Feature): void;
    /**
     * Streams broadcast values declaratively in JSX using a render-prop pattern.
     *
     * Subscribes to the given broadcast action and re-renders when a new value
     * is dispatched. Returns `null` until the first dispatch. The renderer
     * receives the value and an inspect proxy for annotation tracking.
     *
     * @param action - The broadcast action to subscribe to.
     * @param renderer - Callback that receives value and inspect, returns React nodes.
     * @returns React nodes from the renderer, or null if no value has been dispatched.
     *
     * @example
     * ```tsx
     * return (
     *   <div>
     *     {actions.stream(Actions.Broadcast.User, (user, inspect) => (
     *       <span>{user.name}</span>
     *     ))}
     *   </div>
     * );
     * ```
     */
    stream<T extends object>(
      action: BroadcastPayload<T>,
      renderer: (value: T, inspect: Inspect<T>) => React.ReactNode,
    ): React.ReactNode;
  },
] & {
  /**
   * Registers an action handler with the current scope.
   * Types are pre-baked from the useActions call, so no type parameter is needed.
   *
   * Supports two subscription patterns:
   * 1. **Plain action** - Receives ALL dispatches for that action (including channeled ones)
   * 2. **Channeled action** `Action(channel)` - Receives only dispatches matching the channel
   *
   * @param action - The action or channeled action (e.g., `Action({ UserId: 1 })`)
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
   * // Subscribe to UserUpdated for a specific user only (channeled)
   * actions.useAction(Actions.UserUpdated({ UserId: props.userId }), (context, user) => {
   *   // Only fires when dispatched with matching channel
   * });
   * ```
   */
  useAction<A extends ActionId | HandlerPayload | ChanneledAction>(
    action: A,
    handler: (
      context: HandlerContext<M, AC, D>,
      ...args: [Payload<A>] extends [never] ? [] : [payload: Payload<A>]
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
};
