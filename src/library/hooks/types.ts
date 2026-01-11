import type EventEmitter from "eventemitter3";
import type {
  Model,
  ReactiveInterface,
  ActionsClass,
  Props,
  Task,
} from "../types/index.ts";

export type ActionHandler<
  M extends Model = Model,
  AC extends ActionsClass = ActionsClass,
  S extends Props = Props,
> = (
  context: ReactiveInterface<M, AC, S>,
  payload: unknown,
) => void | Promise<void> | AsyncGenerator | Generator;

export type ActionsScope<
  M extends Model = Model,
  AC extends ActionsClass = ActionsClass,
  S extends Props = Props,
> = {
  handlers: Map<symbol, ActionHandler<M, AC, S>>;
};

/**
 * Configuration for {@link useLifecycles}.
 */
export type LifecycleConfig = {
  unicast: EventEmitter;
  tasks: Set<Task>;
};
