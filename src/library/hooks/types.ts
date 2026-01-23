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
} from "../types/index.ts";

/**
 * Function signature for action handlers registered via `useAction`.
 * Receives the reactive context and payload, returning void or a promise/generator.
 *
 * @template M - The model type
 * @template AC - The actions class type
 * @template D - The data props type
 */
export type Handler<
  M extends Model = Model,
  AC extends Actions = Actions,
  D extends Props = Props,
> = (
  context: HandlerContext<M, AC, D>,
  payload: unknown,
) => void | Promise<void> | AsyncGenerator | Generator;

/**
 * Entry for an action handler with a reactive channel getter.
 * When getChannel returns undefined, the handler fires for all dispatches.
 * When getChannel returns a channel, dispatches must match.
 */
export type HandlerEntry<
  M extends Model = Model,
  AC extends Actions = Actions,
  D extends Props = Props,
> = {
  handler: Handler<M, AC, D>;
  getChannel: () => Filter | undefined;
};

/**
 * Internal scope for tracking registered action handlers.
 * Maps action IDs to sets of handler entries (with optional channels).
 *
 * @template M - The model type
 * @template AC - The actions class type
 * @template D - The data props type
 */
export type Scope<
  M extends Model = Model,
  AC extends Actions = Actions,
  D extends Props = Props,
> = {
  /** All handlers for each action, with optional channels */
  handlers: Map<ActionId, Set<HandlerEntry<M, AC, D>>>;
};

/**
 * Function type for the data snapshot passed to useActions.
 * Returns the current reactive values to be captured in the context.
 *
 * @template D - The data props type
 */
export type Data<D extends Props = Props> = () => D;

/**
 * Configuration for {@link useLifecycles}.
 */
export type LifecycleConfig = {
  unicast: EventEmitter;
  tasks: Tasks;
  distributedActions: Set<ActionId>;
  phase: RefObject<Phase>;
  data: Props;
};
