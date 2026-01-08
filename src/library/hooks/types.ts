import type * as React from "react";
import type { State, Inspect } from "immertation";
import type EventEmitter from "eventemitter3";
import type {
  Model,
  Context,
  ActionsClass,
  Status,
  Payload,
} from "../types/index.ts";
import type { Regulator } from "../regulator/utils.ts";

export type ActionHandler<
  M extends Model = Model,
  AC extends ActionsClass = ActionsClass,
> = (
  context: Context<M, AC>,
  payload: unknown,
) => void | Promise<void> | AsyncGenerator | Generator;

/**
 * Primitive types that can be used as reactive dependencies for change detection.
 */
export type Primitive = string | number | boolean | null | undefined | symbol;

/**
 * Context provided to reactive/poll callback functions.
 */
export type SnapshotContext<M = unknown> = {
  model: M;
  inspect: Inspect<M>;
};

/**
 * Represents a reactive binding that triggers an action when dependencies change.
 */
export type ReactiveEntry<P = unknown, M = unknown> = {
  action: Payload<P>;
  getDependencies: (context: SnapshotContext<M>) => Primitive[];
  getPayload: ((context: SnapshotContext<M>) => P) | undefined;
};

/**
 * Represents a poll binding that triggers an action at regular intervals.
 */
export type PollEntry<P = unknown, M = unknown> = {
  action: Payload<P>;
  interval: number;
  getPayload: ((context: SnapshotContext<M>) => P) | undefined;
  getStatus: (context: SnapshotContext<M>) => Status;
};

export type ActionsScope<
  M extends Model = Model,
  AC extends ActionsClass = ActionsClass,
> = {
  handlers: Map<symbol, ActionHandler<M, AC>>;
  reactives: Set<ReactiveEntry>;
  polls: Set<PollEntry>;
};

/**
 * Configuration for {@link useReactives}.
 */
export type ReactivesConfig<M extends Model> = {
  model: M;
  state: React.RefObject<State<M>>;
  checksums: React.RefObject<Map<symbol, string | null>>;
  scope: React.RefObject<ActionsScope>;
  unicast: EventEmitter;
};

/**
 * Configuration for {@link usePollings}.
 */
export type PollingsConfig<M extends Model> = {
  state: React.RefObject<State<M>>;
  scope: React.RefObject<ActionsScope>;
  unicast: EventEmitter;
};

/**
 * Configuration for {@link useLifecycle}.
 */
export type LifecycleConfig = {
  unicast: EventEmitter;
  regulator: React.RefObject<Regulator>;
};
