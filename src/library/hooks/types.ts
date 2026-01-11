import type * as React from "react";
import type EventEmitter from "eventemitter3";
import type {
  Model,
  ReactiveInterface,
  ActionsClass,
  Props,
} from "../types/index.ts";
import type { Regulator } from "../regulator/utils.ts";

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
 * Configuration for {@link useLifecycle}.
 */
export type LifecycleConfig = {
  unicast: EventEmitter;
  regulator: React.RefObject<Regulator>;
};
