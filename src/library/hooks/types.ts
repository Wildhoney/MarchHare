import type EventEmitter from "eventemitter3";
import type { RefObject } from "react";
import type {
  Model,
  HandlerContext,
  Actions,
  Props,
  Tasks,
  ActionId,
  Phase,
  Filter,
  ExtractNodes,
} from "../types/index.ts";
import type { BroadcastEmitter } from "../boundary/components/broadcast/utils.ts";
import type { ScopeContext } from "../boundary/components/scope/types.ts";

/**
 * Return type for the useNodes hook.
 * Contains refs for captured nodes, pending captures, and last emitted nodes.
 *
 * @template M - The model type containing a `nodes` property
 */
export type References<M extends Model | void> = {
  /** Ref containing captured DOM nodes by name */
  refs: RefObject<{ [K in keyof ExtractNodes<M>]: ExtractNodes<M>[K] | null }>;
  /** Ref containing pending node captures to be processed after render */
  pending: RefObject<
    Map<keyof ExtractNodes<M>, ExtractNodes<M>[keyof ExtractNodes<M>] | null>
  >;
  /** Ref containing last emitted node values to detect true changes */
  emitted: RefObject<
    Map<keyof ExtractNodes<M>, ExtractNodes<M>[keyof ExtractNodes<M>] | null>
  >;
};

/**
 * Function signature for action handlers registered via `useAction`.
 * Receives the reactive context and payload, returning void or a promise/generator.
 *
 * @template M - The model type
 * @template A - The actions class type
 * @template D - The data props type
 */
export type Handler<
  M extends Model | void = Model,
  A extends Actions | void = Actions,
  D extends Props = Props,
> = (
  context: HandlerContext<M, A, D>,
  payload: unknown,
) => void | Promise<void> | AsyncGenerator | Generator;

/**
 * Entry for an action handler with a reactive channel getter.
 * When getChannel returns undefined, the handler fires for all dispatches.
 * When getChannel returns a channel, dispatches must match.
 */
export type HandlerEntry<
  M extends Model | void = Model,
  A extends Actions | void = Actions,
  D extends Props = Props,
> = {
  handler: Handler<M, A, D>;
  getChannel: () => Filter | undefined;
};

/**
 * Internal scope for tracking registered action handlers.
 * Maps action IDs to sets of handler entries (with optional channels).
 *
 * @template M - The model type
 * @template A - The actions class type
 * @template D - The data props type
 */
export type Scope<
  M extends Model | void = Model,
  A extends Actions | void = Actions,
  D extends Props = Props,
> = {
  /** All handlers for each action, with optional channels */
  handlers: Map<ActionId, Set<HandlerEntry<M, A, D>>>;
};

/**
 * Function type for the data snapshot passed to useActions.
 * Returns the current reactive values to be captured in the context.
 *
 * @template D - The data props type
 */
export type Data<D extends Props = Props> = () => D;

/**
 * Return type for useDispatchers hook.
 */
export type Dispatchers = {
  /** Set of registered broadcast action IDs */
  broadcast: Set<ActionId>;
  /** Set of registered multicast action IDs */
  multicast: Set<ActionId>;
};

/**
 * Configuration for {@link useLifecycles}.
 */
export type LifecycleConfig = {
  /** Component-local event emitter for unicast action dispatch */
  unicast: EventEmitter;
  /** Shared broadcast emitter with cached values for cross-component events */
  broadcast: BroadcastEmitter;
  /** Global set of all in-flight tasks across components */
  tasks: Tasks;
  /** Tracked broadcast and multicast action sets for cached replay on mount */
  dispatchers: Dispatchers;
  /** Scope context for multicast cached replay (null when outside any scope) */
  scope: ScopeContext;
  /** Mutable ref tracking the component's current lifecycle phase */
  phase: RefObject<Phase>;
  /** Current snapshot of reactive data props for change detection */
  data: Props;
  /** Handler registry for lifecycle action discovery */
  handlers: Map<ActionId, Set<unknown>>;
};
