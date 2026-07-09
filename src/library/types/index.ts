import * as React from "react";
import { Operation } from "immertation";
import { Process, Inspect as ImmInspect, Box } from "immertation";
import type {
  ActionId,
  Task,
  Tasks,
} from "../boundary/components/tasks/types.ts";
import type { Fault } from "../error/types.ts";
import type { Env } from "../boundary/components/env/types.ts";
import type { Invocation, LocalInvocation } from "../resource/types.ts";
import type { WithHandle } from "../with/types.ts";

/**
 * Bounded recursion depths for {@link Inspect}. Matches Immertation's
 * `DepthLimiter` shape so the two stay in lock-step.
 */
type DepthLimiter = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Union of all keys across each arm of `T`. */
type UnionKeys<T> = T extends unknown ? keyof T : never;

/** The value at `K` for each arm of `T`, falling back to `undefined` if `K` is absent on that arm. */
type ValueAt<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : undefined
  : never;

/**
 * March-hare's `Inspect<T>` wraps Immertation's so that property
 * navigation works when `T` is a discriminated union (e.g. the App's
 * Env union). For each key that appears on **any** union arm, the
 * resulting Inspect is `Inspect<ValueAt<T, K>>` &mdash; arms missing
 * the key contribute `undefined`, so optional chaining stays sound.
 *
 * For a single concrete `T`, the wrapper is transparent.
 */
export type Inspect<T, D extends number = 8> = ImmInspect<T> &
  ([D] extends [0]
    ? object
    : {
        [K in UnionKeys<T> as ValueAt<T, K> extends (
          ...args: unknown[]
        ) => unknown
          ? never
          : K]: Inspect<ValueAt<T, K>, DepthLimiter[D]>;
      });

/**
 * Fetch-configured chain returned from `.exceeds(...)` and
 * `.isolated()`. Awaiting the chain runs the fetch with whichever
 * options are set; `.evict()` is intentionally absent because the
 * "configured a fetch then evicted instead" sequence has no coherent
 * meaning &mdash; eviction is always available off the bare
 * `context.actions.resource(...)` call.
 *
 * Concurrent callers with the same `(Resource, params)` automatically
 * share a single in-flight fetch &mdash; one network request, every
 * caller resolves with the same payload. The shared fetch runs on a
 * detached `AbortController` so one caller's abort never cancels work
 * other callers are still waiting on; when every caller has released
 * (their `context.task.controller` aborted) the shared controller is
 * aborted too. Chain `.isolated()` to opt out for the rare case that
 * needs an independent request.
 */
export type ResourceFetch<T> = PromiseLike<T> & {
  /**
   * Skip the fetch when the cached payload is within `duration`.
   * Accepts a `Temporal.Duration`, a `DurationLike` object
   * (`{ minutes: 5 }`), or an ISO 8601 string (`"PT5M"`).
   */
  readonly exceeds: (duration: Temporal.DurationLike) => ResourceFetch<T>;
  /**
   * Opt this call out of the default `(Resource, params)` coalesce
   * path. The fetch fires as an independent network request against
   * the caller's own `context.task.controller` &mdash; no joining of
   * any in-flight fetch, no refcounted detached controller. Aborting
   * the caller's task cancels the network exactly as a regular fetch
   * would.
   *
   * Reach for this only when two callers need parallel fetches with
   * byte-identical params and the difference in intent genuinely can't
   * be modelled by differing params. The default is almost always
   * what you want.
   */
  readonly isolated: () => ResourceFetch<T>;
};

/**
 * Chainable handle returned from `context.actions.resource(invocation)`.
 * Either resolve to the fetched value (`.exceeds`/`.isolated` + await)
 * or drop the cache slot (`.evict`) &mdash; the two paths are mutually
 * exclusive, so once `.exceeds` or `.isolated` runs the chain narrows
 * to {@link ResourceFetch} and `.evict` is no longer available.
 */
/**
 * Handle returned from `context.actions.resource(invocation)` when the
 * invocation came from a local (fetcherless) Resource. There is no
 * fetch to await and no freshness window to configure, so the handle
 * is not thenable and carries no `.exceeds(...)`/`.isolated()` &mdash;
 * only the two cache transitions a local Resource supports.
 */
export type LocalResourceCall<T> = {
  /**
   * Write `value` into the slot addressed by the originating call's
   * params, then fire the Resource's `.action()` auto-broadcast with
   * the value as the payload and the params as the channel &mdash; the
   * same cache-write-then-broadcast sequence a successful fetch
   * performs on a fetched Resource. Synchronous; subscribers observe a
   * warm cache.
   *
   * ```ts
   * context.actions.resource(resource.draft({ id: 5 })).set(draft);
   * ```
   */
  readonly set: (value: T) => void;
  /**
   * Drop cache entries for the primed resource. Identical semantics to
   * the fetched variant's `.evict` &mdash; partial-match on the stored
   * params, `null` broadcast per evicted slot.
   */
  readonly evict: (where?: Record<string, unknown>) => void;
};

/**
 * Dispatch surface exposed as `context.actions.resource`. Overloaded on
 * the invocation's origin: a local (fetcherless) invocation resolves to
 * a {@link LocalResourceCall} (`.set`/`.evict` only), a fetched
 * invocation to a {@link ResourceCall} (awaitable fetch chain plus
 * `.evict`). `.nuke(where?)` spans every Resource in the process.
 */
export type ResourceDispatcher = (<T, P extends object>(
  invocation: LocalInvocation<T, P>,
) => LocalResourceCall<T>) &
  (<T, P extends object>(invocation: Invocation<T, P>) => ResourceCall<T>) & {
    nuke(where?: Record<string, unknown>): void;
  };

export type ResourceCall<T> = ResourceFetch<T> & {
  /**
   * Drop cache entries for the primed resource without fetching. With
   * no argument, uses the params from the originating call as the
   * pattern. With an argument, evicts every stored entry whose params
   * satisfy the pattern's keys (partial match &mdash; extra keys in
   * the stored params are ignored).
   *
   * Strictly synchronous &mdash; the Adapter contract is sync, so the
   * warm-start `Map` and the user adapter both settle in the current
   * tick. Async backends fire-and-forget their underlying delete from
   * inside the adapter body; the call site doesn't `await` anything.
   *
   * The `where` pattern is typed as `Record<string, unknown>` rather
   * than `Partial<P>` because the resource's params type `P` isn't
   * threaded through the chain. Pass the literal you'd pass to the
   * underlying fetcher &mdash; TypeScript won't catch typos in pattern
   * keys, so prefer the no-argument form when possible.
   *
   * ```ts
   * // Drop the {id: 5} slot.
   * context.actions.resource(resource.user({ id: 5 })).evict();
   *
   * // Drop every user slot whose stored params include name "Adam".
   * context.actions.resource(resource.user()).evict({ name: "Adam" });
   * ```
   */
  readonly evict: (where?: Record<string, unknown>) => void;
};
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
 * Recursive readonly. Locks every nested property so that read-only
 * projections on `context` (model, data, env) reject direct assignment
 * &mdash; mutation must go through `context.actions.produce(...)`.
 *
 * Function types pass through untouched so method calls (e.g.
 * `AbortController#abort`) remain callable. Built-in mutable containers
 * are mapped to their readonly counterparts.
 *
 * @internal
 */
export type DeepReadonly<T> = T extends (...args: never) => unknown
  ? T
  : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends ReadonlySet<infer U>
        ? ReadonlySet<DeepReadonly<U>>
        : T extends object
          ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
          : T;

/**
 * Union type representing any valid action that can be passed to action utilities.
 * Covers raw ActionIds (symbol/string), branded action values (`Action()` /
 * `Lifecycle.*()` results carrying `Brand.Action`), and any other symbol-keyed
 * branded object.
 */
export type AnyAction = ActionId | BrandedAction | BrandedObject;

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
  /**
   * Phantom brand carrying the action's literal name. Used purely at the
   * type level to make `Action("X")` and `Action("Y")` produce
   * structurally-distinct types so `dispatch`/`useAction` can reject
   * symbols imported from a class outside `AC`.
   */
  static readonly Name = Symbol("march-hare.brand/Name");
  /**
   * Phantom brand identifying lifecycle actions returned by
   * `Lifecycle.Mount()`, `Lifecycle.Paint()`, `Lifecycle.Unmount()`,
   * `Lifecycle.Error()`, and `Lifecycle.Update()`. Carries the lifecycle's
   * literal kind so that `useAction` can pick distinct overloads &mdash; in
   * particular,
   * `Lifecycle.Update` resolves its payload to `Partial<DeepReadonly<D>>`
   * against the surrounding `useActions` data generic instead of the
   * factory-level `Record<string, unknown>` placeholder. Without this
   * brand a user-defined `Action<P>("Update")` would collide with the
   * lifecycle overload.
   */
  static readonly Lifecycle = Symbol("march-hare.brand/Lifecycle");
}

/**
 * Creates a lifecycle action with the given name.
 * Produces a branded `HandlerPayload` backed by a fresh
 * `Symbol("march-hare.action.lifecycle/${name}")` on each call.
 *
 * @internal
 */
function createLifecycleAction<
  P = never,
  C extends Filter = never,
  K extends string = string,
>(name: K): LifecyclePayload<P, C, K> {
  const symbol = Symbol(`march-hare.action.lifecycle/${name}`);
  const action = function (channel: C): ChanneledAction<P, C, K> {
    return {
      [Brand.Action]: symbol,
      [Brand.Payload]: <P>undefined,
      [Brand.Channel]: channel,
      [Brand.Name]: name,
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
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Name, { value: name, enumerable: false });
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Lifecycle, {
    value: name,
    enumerable: false,
  });
  return <LifecyclePayload<P, C, K>>action;
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
 * Internal symbol for the global `Lifecycle.Env` broadcast. The env
 * mutation path in `useActions` fires this symbol whenever a
 * `produce({ env })` call changes the slot reference.
 *
 * @internal
 */
export const EnvSymbol: unique symbol = <typeof EnvSymbol>(
  Symbol(describe.broadcast("Env"))
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
 *   static Paint = Lifecycle.Paint();
 *   static Unmount = Lifecycle.Unmount();
 *   static Error = Lifecycle.Error();
 *   static Update = Lifecycle.Update();
 *
 *   static Increment = Action("Increment");
 * }
 * ```
 *
 * `Lifecycle.Fault` and `Lifecycle.Env` are singleton broadcasts (not
 * factories). All components subscribe to the same shared symbol &mdash;
 * `Fault` delivers global fault notifications, `Env` delivers per-`Boundary`
 * env-change notifications.
 */
export class Lifecycle {
  /** Creates a Mount lifecycle action. Triggered once on component mount (`useLayoutEffect`). */
  static Mount(): LifecyclePayload<never, never, "Mount"> {
    return createLifecycleAction<never, never, "Mount">("Mount");
  }

  /**
   * Creates a Paint lifecycle action. Triggered once after the browser has
   * committed the first frame (`useEffect`). Pairs with {@link Lifecycle.Mount}
   * (pre-paint) &mdash; use Paint for work that should not delay the first
   * paint: analytics &ldquo;viewed&rdquo; events, focus management, scroll-into-view,
   * non-blocking prefetch, etc.
   */
  static Paint(): LifecyclePayload<never, never, "Paint"> {
    return createLifecycleAction<never, never, "Paint">("Paint");
  }

  /** Creates an Unmount lifecycle action. Triggered when the component unmounts. */
  static Unmount(): LifecyclePayload<never, never, "Unmount"> {
    return createLifecycleAction<never, never, "Unmount">("Unmount");
  }

  /** Creates an Error lifecycle action. Triggered when an action throws. Receives `Fault` as payload. */
  static Error(): LifecyclePayload<Fault, never, "Error"> {
    return createLifecycleAction<Fault, never, "Error">("Error");
  }

  /**
   * Creates an Update lifecycle action. Triggered when `context.data` changes
   * (not on initial mount). The handler payload is typed as
   * `Partial<DeepReadonly<D>>` at the subscription site &mdash; only the keys
   * whose values changed between the previous and current render are present.
   */
  static Update(): LifecyclePayload<Record<string, unknown>, never, "Update"> {
    return createLifecycleAction<Record<string, unknown>, never, "Update">(
      "Update",
    );
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
  static Fault: BroadcastPayload<Fault, never, "Fault"> = (() => {
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
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Name, {
      value: "Fault",
      enumerable: false,
    });
    return <BroadcastPayload<Fault, never, "Fault">>(<unknown>action);
  })();

  /**
   * Global env-change broadcast. Receives the latest {@link Env}
   * snapshot whenever a `context.actions.produce(({ env }) => ...)` call
   * mutates the slot. Subscribe via
   * `actions.useAction(Lifecycle.Env, handler)` &mdash; or render against
   * it directly with `actions.stream(Lifecycle.Env, (env) => ...)`.
   *
   * Like `Lifecycle.Fault`, this is a singleton broadcast (not a factory):
   * every subscriber points at the same shared symbol. The latest value is
   * cached on the broadcast emitter so that late-mounting handlers and
   * streams receive the current env on mount.
   *
   * @example
   * ```tsx
   * actions.useAction(Lifecycle.Env, (context, env) => {
   *   console.log("env changed", env);
   * });
   *
   * // In JSX:
   * {actions.stream(Lifecycle.Env, (env) => (
   *   <span>{env.locale}</span>
   * ))}
   * ```
   */
  static Env: BroadcastPayload<Env, never, "Env"> = (() => {
    const action: Record<symbol, unknown> = {};
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Action, {
      value: EnvSymbol,
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
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Name, {
      value: "Env",
      enumerable: false,
    });
    return <BroadcastPayload<Env, never, "Env">>(<unknown>action);
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
 *   rendering inside a `<scope.Boundary>` produced by `app.Scope<MulticastActions>()`.
 *
 * @example
 * ```ts
 * export class MulticastActions {
 *   static Mood = Action<Mood>("Mood", Distribution.Multicast);
 * }
 *
 * export const scope = app.Scope<typeof MulticastActions>();
 *
 * // Wrap the subtree where the scope applies.
 * export default function Mood() {
 *   return (
 *     <scope.Boundary>
 *       <Happy />
 *       <Sad />
 *     </scope.Boundary>
 *   );
 * }
 *
 * // Dispatch / subscribe — no extra options.
 * actions.dispatch(MulticastActions.Mood, mood);
 * actions.useAction(MulticastActions.Mood, (context, mood) => { ... });
 * ```
 */
export enum Distribution {
  /** Action is scoped to the component that defines it. This is the default. */
  Unicast = "unicast",
  /** Action is broadcast to all mounted components and can be consumed. */
  Broadcast = "broadcast",
  /** Action is multicast to every component inside its `<scope.Boundary>`. */
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
 * Maybe-present field type &mdash; a value that may be a concrete `T`,
 * or `null` / `undefined` while loading, awaiting a fetch, or before
 * upstream data has arrived. Use this for model fields whose presence
 * is determined by async or external state.
 *
 * @template T - The concrete value type
 */
export type Maybe<T> = T | null | undefined;

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
export type HandlerPayload<
  P = unknown,
  C extends Filter = never,
  Name extends string = string,
> = {
  readonly [Brand.Action]: symbol;
  readonly [Brand.Payload]: P;
  readonly [Brand.Name]: Name;
  readonly [Brand.Broadcast]?: boolean;
} & ([C] extends [never]
  ? unknown
  : {
      (channel: C): ChanneledAction<P, C, Name>;
    });

/**
 * Branded type returned by `Lifecycle.Mount`, `Lifecycle.Paint`,
 * `Lifecycle.Unmount`, `Lifecycle.Error`, and `Lifecycle.Update`.
 * Structurally identical to a `HandlerPayload` but carries a phantom
 * `Brand.Lifecycle` brand whose value is the lifecycle's literal kind. The
 * brand is what lets `useAction` and `Handlers` resolve `Lifecycle.Update`'s
 * payload to `Partial<DeepReadonly<D>>` (against the surrounding `useActions`
 * data generic) instead of the factory-level `Record<string, unknown>`
 * placeholder &mdash; a user-defined `Action<P>("Update")` would have
 * `Name = "Update"` but no `Brand.Lifecycle`, so it falls into the generic
 * payload overload as expected.
 *
 * @template P Payload type for the lifecycle.
 * @template C Channel filter (always `never` for lifecycles &mdash; they are
 *   not channeled).
 * @template Name Literal name (`"Mount"`, `"Paint"`, `"Unmount"`, `"Error"`, `"Update"`).
 */
export type LifecyclePayload<
  P = unknown,
  C extends Filter = never,
  Name extends string = string,
> = HandlerPayload<P, C, Name> & {
  readonly [Brand.Lifecycle]: Name;
};

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
export type ChanneledAction<
  P = unknown,
  C = unknown,
  Name extends string = string,
> = {
  readonly [Brand.Action]: symbol;
  readonly [Brand.Payload]: P;
  readonly [Brand.Channel]: C;
  readonly [Brand.Name]: Name;
  readonly [Brand.Broadcast]?: boolean;
  readonly channel: C;
};

/**
 * `ChanneledAction` that carries the broadcast brand. Produced by calling
 * a broadcast `Action` with a channel (e.g. `Resource.action({ id: 5 })`,
 * or `UserBroadcast({ UserId: 5 })`). Any boundary subscriber can listen
 * to one, so it's admitted by `Subscribable<AC>` regardless of `AC`
 * &mdash; the same carve-out applied to `Lifecycle.Fault` / `Lifecycle.Env`.
 */
export type BroadcastChanneled<
  P = unknown,
  C = unknown,
  Name extends string = string,
> = ChanneledAction<P, C, Name> & {
  readonly [Brand.Broadcast]: true;
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
 * that only broadcast actions can be passed to `context.actions.final()`.
 *
 * @template P - The payload type for the action
 * @template C - The channel type for channeled dispatches (defaults to never)
 *
 * @example
 * ```ts
 * const SignedOut = Action<User>("SignedOut", Distribution.Broadcast);
 *
 * // Resolve the latest value inside a handler
 * const user = await context.actions.final(SignedOut);
 * ```
 */
export type BroadcastPayload<
  P = unknown,
  C extends Filter = never,
  Name extends string = string,
> = HandlerPayload<P, C, Name> & {
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
  Name extends string = string,
> = HandlerPayload<P, C, Name> & {
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
 * **Matching direction:** the subscriber's filter is the constraint;
 * every key the subscriber supplies must be present and equal on the
 * dispatch channel. Extra keys on the dispatch channel are ignored, so a
 * dispatcher is free to be more specific than any single subscriber
 * needs. A subscriber that supplies no keys (uncalled action or empty
 * filter) matches every dispatch.
 *
 * @example
 * ```ts
 * actions.useAction(Actions.User({ UserId: 1 }), handler);
 *
 * actions.dispatch(Actions.User({ UserId: 1 }), payload);                       // Matches (exact)
 * actions.dispatch(Actions.User({ UserId: 2 }), payload);                       // No match (UserId mismatch)
 * actions.dispatch(Actions.User({ UserId: 1, Role: "admin" }), payload);        // Matches (extra dispatch keys ignored)
 * actions.dispatch(Actions.User({}), payload);                                  // No match (subscriber asked for UserId)
 * actions.dispatch(Actions.User, payload);                                      // Matches ALL handlers (uncalled bypasses channel filtering)
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
 * Type guard that produces a compile-time error if an async function is
 * passed. Used to enforce synchronous callbacks in `produce()`.
 *
 * The `[F]` tuple wrapping prevents distribution over function unions, and
 * checking the actual signature (`(...args: never[]) => Promise<unknown>`)
 * sidesteps TypeScript's lenient `Promise<void>`→`void` assignability that
 * would otherwise let an async recipe satisfy a `(draft) => void`
 * constraint. Async F collapses the argument type to `never`, which no
 * function value can satisfy.
 *
 * @internal
 */
type AssertSync<F> = [F] extends [(...args: never[]) => Promise<unknown>]
  ? never
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
  AC extends Actions | void,
  D extends Props = Props,
  E extends Env = Env,
> = {
  readonly model: DeepReadonly<M>;
  readonly phase: Phase;
  readonly task: Task;
  readonly data: DeepReadonly<D>;
  readonly tasks: ReadonlySet<Task>;
  readonly env: Readonly<E>;
  readonly actions: {
    produce<
      F extends (draft: {
        model: M;
        env: E;
        readonly inspect: Readonly<Inspect<M>>;
      }) => void,
    >(
      ƒ: F & AssertSync<F>,
    ): void;
    dispatch(action: NoPayloadActions<Dispatchable<AC>>): Promise<void>;
    dispatch<A extends WithPayloadActions<Dispatchable<AC>>>(
      action: A,
      payload: Payload<A>,
    ): Promise<void>;
    annotate<T>(value: T, operation?: Operation): T;
    readonly inspect: Readonly<Inspect<M>>;
    resource: ResourceDispatcher;
    final<T>(
      action: BroadcastPayload<T> | MulticastPayload<T>,
    ): Promise<T | null>;
    peek<T>(action: BroadcastPayload<T> | MulticastPayload<T>): T | null;
  };
};

/**
 * Return type for the useActions hook.
 *
 * A tuple containing:
 * 1. The current model state of type M
 * 2. An actions object with dispatch and inspect capabilities
 * 3. The current data snapshot of type D &mdash; the same React-owned values
 *    that handlers read via `context.data`, exposed here for JSX consumption
 *    so the view and the handler share a single named source of truth.
 *
 * @template M - The model type representing the component's state
 * @template AC - The actions class containing action definitions
 * @template D - The data type for reactive external values
 *
 * @example
 * ```tsx
 * const [model, actions, data] = useActions<Model, typeof Actions, Data>(
 *   model,
 *   () => ({ user, theme }),
 * );
 *
 * // Access state
 * model.count;
 *
 * // Dispatch actions
 * actions.dispatch(Actions.Increment, 5);
 *
 * // Read React-owned dependencies in JSX (same values as context.data)
 * data.user.name;
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
  E extends Env = Env,
> = (
  context: HandlerContext<M, AC, D, E>,
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
 * Recursively flattens an actions class into the union of its leaf action
 * types. A "leaf" is any property whose own string keys are empty &mdash; the
 * branded `HandlerPayload` / `BroadcastPayload` / `MulticastPayload` values
 * produced by `Action(...)` and `Lifecycle.*()`. Nested namespace classes
 * (e.g. `static Broadcast = BroadcastActions`) are descended into.
 *
 * Used to constrain `dispatch` and `useAction` so that only actions owned by
 * the component's `AC` (plus the global `Lifecycle.Fault` /
 * `Lifecycle.Env`) can be referenced.
 */
export type LeafActions<AC> = AC extends void
  ? never
  : {
      [K in OwnKeys<AC>]: OwnKeys<AC[K]> extends never
        ? AC[K]
        : LeafActions<AC[K]>;
    }[OwnKeys<AC>];

/**
 * Maps each action in a union to its channeled-call variant, when one exists.
 * Distributes over unions so a mixed bag of leaf actions produces the union
 * of their `ChanneledAction<P, C>` results.
 */
export type ChanneledOf<A> =
  A extends HandlerPayload<infer P, infer C>
    ? [C] extends [never]
      ? never
      : ChanneledAction<P, C>
    : never;

/**
 * Everything `dispatch` accepts for a given `AC`: leaf actions on the class
 * and their channeled-call variants. The shared `Lifecycle.Fault` broadcast
 * is excluded — it's library-internal and not user-dispatchable.
 */
export type Dispatchable<AC> = LeafActions<AC> | ChanneledOf<LeafActions<AC>>;

/**
 * Everything `useAction` will subscribe to for a given `AC`. Includes:
 *
 * - `Dispatchable<AC>` &mdash; leaf actions on `AC` plus their channeled
 *   variants.
 * - `Lifecycle.Fault` / `Lifecycle.Env` &mdash; shared boundary broadcasts.
 * - Any `LifecyclePayload` (`Lifecycle.Mount()`, `Lifecycle.Unmount()`,
 *   etc.) &mdash; the runtime scans the handler registry for a matching
 *   lifecycle brand on emit, so a self-declared lifecycle outside `AC`
 *   still fires.
 * - Any broadcast-branded channeled action &mdash; resource auto-broadcasts
 *   (`resource.x.action(...)`) live outside `AC` but any boundary
 *   subscriber can listen to them.
 */
export type Subscribable<AC> =
  | Dispatchable<AC>
  | typeof Lifecycle.Fault
  | typeof Lifecycle.Env
  | LifecyclePayload<unknown, never, string>
  | BroadcastChanneled;

/**
 * Subset of a union of actions whose payload type is `never`. Used to split
 * `dispatch`/`useAction` into a no-payload and a with-payload overload so
 * TypeScript reports a clear "no overload matches" error instead of widening
 * the inferred action type when constraints don't match.
 */
export type NoPayloadActions<U> = Extract<
  U,
  { readonly [Brand.Payload]: never }
>;

/** Subset of a union of actions whose payload type is non-`never`. */
export type WithPayloadActions<U> = Exclude<
  U,
  { readonly [Brand.Payload]: never }
>;

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
 * import { Action, Distribution, type Handlers } from "march-hare";
 *
 * class BroadcastActions {
 *   static PaymentSent = Action("PaymentSent", Distribution.Broadcast);
 *   static PaymentLink = Action<PaymentLinkData>(
 *     "PaymentLink",
 *     Distribution.Broadcast,
 *   );
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
  RootAC extends Actions | void = AC,
  E extends Env = Env,
> = {
  [K in OwnKeys<AC>]: OwnKeys<AC[K]> extends never
    ? AC[K] extends { readonly [Brand.Lifecycle]: "Update" }
      ? (
          context: HandlerContext<M, RootAC, D, E>,
          changes: Partial<DeepReadonly<D>>,
        ) => void | Promise<void> | AsyncGenerator | Generator
      : (
          context: HandlerContext<M, RootAC, D, E>,
          ...args: [Payload<AC[K] & HandlerPayload<unknown>>] extends [never]
            ? []
            : [payload: Payload<AC[K] & HandlerPayload<unknown>>]
        ) => void | Promise<void> | AsyncGenerator | Generator
    : Handlers<M, AC[K] & Actions, D, RootAC, E>;
};

export type UseActions<
  M extends Model | void,
  AC extends Actions | void,
  D extends Props = Props,
  E extends Env = Env,
> = [
  Readonly<M>,
  {
    /**
     * Dispatches an action with an optional payload. Multicast actions read
     * their scope from the action declaration, so no extra options are
     * required at the call site.
     */
    dispatch(action: NoPayloadActions<Dispatchable<AC>>): Promise<void>;
    dispatch<A extends WithPayloadActions<Dispatchable<AC>>>(
      action: A,
      payload: Payload<A>,
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
    stream(
      action: typeof Lifecycle.Env,
      renderer: (value: Readonly<E>, inspect: Inspect<E>) => React.ReactNode,
    ): React.ReactNode;
    stream<T extends object | null>(
      action: BroadcastPayload<T> | BroadcastChanneled<T>,
      renderer: (value: T, inspect: Inspect<T>) => React.ReactNode,
    ): React.ReactNode;
  },
  DeepReadonly<D>,
] & {
  /**
   * Dispatches an action with an optional payload &mdash; same as
   * `result[1].dispatch`, exposed on the tuple itself so call sites that
   * already have `actions` in scope can write `actions.dispatch(...)`
   * without indexing into `actions[1]`.
   */
  dispatch(action: NoPayloadActions<Dispatchable<AC>>): Promise<void>;
  dispatch<A extends WithPayloadActions<Dispatchable<AC>>>(
    action: A,
    payload: Payload<A>,
  ): Promise<void>;

  /**
   * Registers an action handler with the current scope.
   * Types are pre-baked from the `channel.use(...)` call, so no type
   * parameter is needed.
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
   * const context = useContext<Model, typeof Actions>();
   * const actions = context.useActions(model);
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
  useAction(
    action: NoPayloadActions<Subscribable<AC>>,
    handler: (
      context: HandlerContext<M, AC, D, E>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
  useAction(
    action: typeof Lifecycle.Env,
    handler: (
      context: HandlerContext<M, AC, D, E>,
      env: Readonly<E>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
  useAction<
    A extends Extract<
      Subscribable<AC>,
      { readonly [Brand.Lifecycle]: "Update" }
    >,
  >(
    action: A,
    handler: (
      context: HandlerContext<M, AC, D, E>,
      changes: Partial<DeepReadonly<D>>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
  useAction<A extends WithPayloadActions<Subscribable<AC>>>(
    action: A,
    handler: (
      context: HandlerContext<M, AC, D, E>,
      payload: Payload<A>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void;
};

/**
 * Stable, typed dispatch function for the actions class `AC`. Same call
 * signatures as `actions.dispatch` returned by `useActions`, available
 * before the paired `useActions` has run via {@link Context}.
 */
export type Dispatch<AC extends Actions | void> = {
  (action: NoPayloadActions<Dispatchable<AC>>): Promise<void>;
  <A extends WithPayloadActions<Dispatchable<AC>>>(
    action: A,
    payload: Payload<A>,
  ): Promise<void>;
};

/**
 * Handle returned by `useContext<M, AC, D>()`. Exposes
 * `dispatch(action, payload?)` and a `useActions` method that materialises
 * the component-local model and reactive data against the same dispatch
 * target. Generics are declared on `useContext`; `useActions` inherits
 * them &mdash; the call site does not re-state `Model` / `Actions` /
 * `Data`.
 *
 * Note: this `Context` type is distinct from React's `useContext` /
 * `React.Context` &mdash; it's the March Hare action surface returned by
 * the `useContext` hook of this library.
 */
export type Context<
  M extends Model | void,
  AC extends Actions | void,
  D extends Props = Props,
  E extends Env = Env,
> = {
  readonly actions: { dispatch: Dispatch<AC> };
  /**
   * Typed bag of handler factories bound to `M`. Methods accept lodash-style
   * dotted paths with array indices (e.g. `"a.b.c"`, `"items.0.id"`) and
   * autocomplete from the model. See {@link WithHandle}.
   */
  readonly with: WithHandle<M>;
  useActions(getData?: () => D): UseActions<M, AC, D, E>;
  useActions(
    model: M extends void ? never : M,
    getData?: () => D,
  ): UseActions<M, AC, D, E>;
};
