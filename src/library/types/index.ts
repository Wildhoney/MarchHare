import * as React from "react";
import { Operation } from "immertation";
import { Process, Inspect, Box } from "immertation";
import type {
  ActionId,
  Task,
  Tasks,
} from "../boundary/components/tasks/types.ts";
import type { Fault } from "../error/types.ts";
import type { Store } from "../boundary/components/store/index.tsx";
import { describe } from "../utils.ts";

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
  static readonly Payload = Symbol("march-hare.brand/Payload");
  /** Brand key for BroadcastPayload type */
  static readonly Broadcast = Symbol("march-hare.brand/Broadcast");
  /** Brand key for MulticastPayload type */
  static readonly Multicast = Symbol("march-hare.brand/Multicast");
  /** Access the underlying symbol from an action */
  static readonly Action = Symbol("march-hare.brand/Action");
  /** Identifies channeled actions (result of calling Action(channel)) */
  static readonly Channel = Symbol("march-hare.brand/Channel");
}

/**
 * Creates a lifecycle action with the given name.
 * Produces a branded `HandlerPayload` backed by a fresh
 * `Symbol("march-hare.action.lifecycle/${name}")` on each call.
 *
 * @internal
 */
function createLifecycleAction<P = never, C extends Filter = never>(
  name: string,
): HandlerPayload<P, C> {
  const symbol = Symbol(`march-hare.action.lifecycle/${name}`);
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
 * Internal symbol for the global `Lifecycle.Fault` broadcast. Exposed so the
 * dispatch pipeline can fire faults without depending on the `Lifecycle`
 * class at runtime.
 *
 * @internal
 */
export const FaultSymbol: unique symbol = <typeof FaultSymbol>(
  Symbol(describe.broadcast("Fault"))
);

/**
 * Factory functions for lifecycle actions.
 *
 * Each call returns a **unique** action symbol so that each component can
 * subscribe independently. Assign the result as a static property in your
 * Actions class:
 *
 * @example
 * ```ts
 * export class Actions {
 *   static Mount = Lifecycle.Mount();
 *   static Unmount = Lifecycle.Unmount();
 *   static Error = Lifecycle.Error();
 *   static Update = Lifecycle.Update();
 *
 *   static Increment = Action("Increment");
 * }
 * ```
 *
 * `Lifecycle.Fault` is a singleton broadcast (not a factory). All components
 * subscribe to the same shared symbol to receive global fault notifications.
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
   * Global fault broadcast. Receives a `Fault` whenever any action in the
   * `<Boundary>` errors, times out, or is supplanted. Subscribe via
   * `actions.useAction(Lifecycle.Fault, handler)`.
   *
   * Unlike the per-component `Lifecycle.Error()` factory, `Fault` is a single
   * shared broadcast — every subscriber points at the same symbol.
   *
   * @example
   * ```tsx
   * const actions = useActions<void, typeof Actions>();
   *
   * actions.useAction(Lifecycle.Fault, (context, fault) => {
   *   if (fault.reason === Reason.Errored) {
   *     console.error(`Action "${fault.action}" failed`, fault.error);
   *   }
   * });
   * ```
   */
  static Fault: BroadcastPayload<Fault> = (() => {
    const action: Record<symbol, unknown> = {};
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Action, {
      value: FaultSymbol,
      enumerable: false,
    });
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Payload, {
      value: undefined,
      enumerable: false,
    });
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Broadcast, {
      value: true,
      enumerable: false,
    });
    return <BroadcastPayload<Fault>>(<unknown>action);
  })();
}

/**
 * Distribution modes for actions.
 *
 * - **Unicast** &ndash; Action is scoped to the component that defines it and cannot be
 *   consumed by other components. This is the default behaviour.
 * - **Broadcast** &ndash; Action is distributed to all mounted components that have
 *   defined a handler for it. Values are cached for late-mounting components.
 * - **Multicast** &ndash; Action defines its own scope. Components reach it by
 *   wrapping a subtree in `withScope(<theMulticastAction>, Component)`.
 *
 * @example
 * ```ts
 * export class Scope {
 *   // The action itself acts as the scope identifier.
 *   static Mood = Action<Mood>("Mood", Distribution.Multicast);
 * }
 *
 * // Wrap the subtree where the scope applies.
 * export default withScope(Scope.Mood, Component);
 *
 * // Dispatch / subscribe — no extra options.
 * actions.dispatch(Scope.Mood, mood);
 * actions.useAction(Scope.Mood, (context, mood) => { ... });
 * ```
 */
export enum Distribution {
  /** Action is scoped to the component that defines it. This is the default. */
  Unicast = "unicast",
  /** Action is broadcast to all mounted components and can be consumed. */
  Broadcast = "broadcast",
  /** Action is multicast to every component inside its `withScope` boundary. */
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
 * Late-mounting components receive the most recent cached payload via their
 * `useAction` handler during mount. Use `peek()` in a `Lifecycle.Mount` handler
 * to check whether a cached value exists before performing default fetches.
 *
 * This type extends `HandlerPayload<P, C>` with an additional brand to enforce at compile-time
 * that only broadcast actions can be passed to `context.actions.resolution()`.
 *
 * @template P - The payload type for the action
 * @template C - The channel type for channeled dispatches (defaults to never)
 *
 * @example
 * ```ts
 * const SignedOut = Action<User>("SignedOut", Distribution.Broadcast);
 *
 * // Resolve the latest value inside a handler
 * const user = await context.actions.resolution(SignedOut);
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
 * actions.dispatch(Actions.Multicast.Update, payload, { scope: Actions.Multicast.Scope });
 * ```
 *
 * Components receive multicast events only if they are descendants of a `<Scope of={...}>`.
 *
 * @template P - The payload type for the action
 * @template C - The channel type for channeled dispatches (defaults to never)
 *
 * @example
 * ```tsx
 * export enum Scope {
 *   Counter = "counter",
 * }
 *
 * class MulticastActions {
 *   static Update = Action<number>("Update", Distribution.Multicast(Scope.Counter));
 * }
 *
 * // Reference from component-level Actions
 * class Actions {
 *   static Multicast = MulticastActions;
 * }
 *
 * // Wrap the subtree where the scope applies via the withScope HOC.
 * export default withScope(Scope.Counter, function Counters() {
 *   return (
 *     <>
 *       <CounterA />
 *       <CounterB />
 *     </>
 *   );
 * });
 *
 * // Dispatch — the scope is read from the action itself.
 * actions.dispatch(Actions.Multicast.Update, 42);
 * ```
 */
export type MulticastPayload<
  P = unknown,
  C extends Filter = never,
> = HandlerPayload<P, C> & {
  readonly [Brand.Multicast]: true;
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
   * Read-only view of the per-`<Boundary>` Store &mdash; ambient,
   * cross-cutting state (session, locale, feature flags, etc.) typed
   * via module augmentation on the library's `Store` interface.
   * Identical to the value returned by `useStore()` at the hook level.
   *
   * Reads use plain dot notation and always reflect the latest value,
   * even after `await` boundaries. Writes go through
   * `context.actions.produce(({ store }) => { store.x = ... })`
   * &mdash; the same Immer-style recipe used for the model.
   *
   * @example
   * ```ts
   * actions.useAction(Actions.SignIn, async (context, credentials) => {
   *   const result = await context.actions.resource(signIn(credentials));
   *   context.actions.produce(({ store }) => {
   *     store.session = result;
   *   });
   * });
   *
   * actions.useAction(Actions.Refresh, async (context) => {
   *   if (context.store.session === null) return;
   *   // ...
   * });
   * ```
   */
  readonly store: Store;
  readonly actions: {
    produce<
      F extends (draft: {
        model: M;
        readonly inspect: Readonly<Inspect<M>>;
        store: Store;
      }) => void,
    >(
      ƒ: F & AssertSync<F>,
    ): void;
    dispatch(action: ActionOrChanneled, payload?: unknown): Promise<void>;
    annotate<T>(value: T, operation?: Operation): T;
    /**
     * Fetches a {@link Resource} with the abort controller and Store
     * snapshot auto-threaded from the current handler context. The
     * argument is a resource invocation (`cat({ id: 5 })`) &mdash; the
     * call primes a slot with the resource and params, and
     * `.resource(...)` reads it. The return value is a thenable &mdash;
     * `await` it to fire the fetch unconditionally, or use
     * `.exceeds(duration)` to short-circuit when the per-params cache
     * slot is still within the supplied freshness window (i.e. fetch
     * only when the cache age *exceeds* the duration).
     *
     * @example
     * ```ts
     * actions.useAction(Actions.Mount, async (context) => {
     *   // Always fetch.
     *   const fresh = await context.actions.resource(user({ id: 5 }));
     *
     *   // Reuse cache when < 5 minutes old.
     *   const maybe = await context.actions
     *     .resource(user({ id: 5 }))
     *     .exceeds({ minutes: 5 });
     *
     *   context.actions.produce(({ model }) => void (model.user = fresh));
     * });
     * ```
     */
    resource: (<T>(invocation: T | null) => PromiseLike<T> & {
      readonly exceeds: (duration: Temporal.DurationLike) => Promise<T>;
    }) & {
      /**
       * Writes `data` into the per-params cache slot of the resource
       * invocation passed as the first argument, with a fresh timestamp.
       * Use this when payloads arrive out-of-band (SSE, WebSocket,
       * postMessage) and need to be reflected in the Resource cache
       * without a fetcher round-trip.
       *
       * @example
       * ```ts
       * actions.useAction(Actions.Broadcast.UserSSE, (context, payload) => {
       *   context.actions.resource.set(user({ id: payload.id }), payload);
       * });
       * ```
       */
      set<T>(invocation: T | null, data: T): void;
    };
    /**
     * Returns the resolved broadcast or multicast value, waiting for any
     * pending annotations to settle before resolving.
     *
     * If a value has already been dispatched it resolves immediately.
     * Otherwise it waits until the next dispatch of the action.
     * Resolves with `null` if the task is aborted before a value arrives.
     *
     * @param action - The broadcast or multicast action to resolve. Multicast
     *   actions read their scope from the action declaration.
     * @returns The dispatched value, or `null` if aborted.
     *
     * @example
     * ```ts
     * actions.useAction(Actions.FetchPosts, async (context) => {
     *   const user = await context.actions.resolution(Actions.Broadcast.User);
     *   if (!user) return;
     *   const posts = await fetchPosts(user.id, {
     *     signal: context.task.controller.signal,
     *   });
     *   context.actions.produce(({ model }) => { model.posts = posts; });
     * });
     * ```
     */
    resolution<T>(
      action: BroadcastPayload<T> | MulticastPayload<T>,
    ): Promise<T | null>;

    /**
     * Returns the latest broadcast or multicast value immediately without
     * waiting for annotations to settle. Use this when you need the current
     * cached value and do not need to wait for pending operations to complete.
     *
     * @param action - The broadcast or multicast action to peek at. Multicast
     *   actions read their scope from the action declaration.
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
    peek<T>(action: BroadcastPayload<T> | MulticastPayload<T>): T | null;
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
 * import { Action, Distribution, Handlers } from "march-hare";
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
     * Dispatches an action with an optional payload. Multicast actions read
     * their scope from the action declaration, so no extra options are
     * required at the call site.
     */
    dispatch<P>(action: HandlerPayload<P>, payload?: P): Promise<void>;
    dispatch<P>(action: BroadcastPayload<P>, payload?: P): Promise<void>;
    dispatch<P>(action: MulticastPayload<P>, payload?: P): Promise<void>;
    dispatch<P, C extends Filter>(
      action: ChanneledAction<P, C>,
      payload?: P,
    ): Promise<void>;
    inspect: Inspect<M>;
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
