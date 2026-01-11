import type * as React from "react";
import type EventEmitter from "eventemitter3";
import type { Model, ReactiveInterface, ActionsClass } from "../types/index.ts";
import type { Regulator } from "../regulator/utils.ts";

export type ActionHandler<
  M extends Model = Model,
  AC extends ActionsClass = ActionsClass,
> = (
  context: ReactiveInterface<M, AC>,
  payload: unknown,
) => void | Promise<void> | AsyncGenerator | Generator;

export type ActionsScope<
  M extends Model = Model,
  AC extends ActionsClass = ActionsClass,
> = {
  handlers: Map<symbol, ActionHandler<M, AC>>;
};

/**
 * Configuration for {@link useLifecycle}.
 */
export type LifecycleConfig = {
  unicast: EventEmitter;
  regulator: React.RefObject<Regulator>;
};
