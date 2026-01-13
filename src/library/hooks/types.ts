import type EventEmitter from "eventemitter3";
import type {
  Model,
  ReactiveInterface,
  Actions,
  Props,
  Tasks,
  ActionId,
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
  context: ReactiveInterface<M, AC, D>,
  payload: unknown,
) => void | Promise<void> | AsyncGenerator | Generator;

/**
 * Internal scope for tracking registered action handlers.
 * Stores a map of action IDs to their handler functions.
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
  handlers: Map<ActionId, Handler<M, AC, D>>;
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
};
