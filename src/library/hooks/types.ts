import type * as React from "react";
import type { State } from "immertation";
import type EventEmitter from "eventemitter3";
import type { Model } from "../types/index.ts";
import type { DecoratorContext } from "../use/types.ts";
import type { Regulator } from "../regulator/utils.ts";

export type Store = State<Record<string, unknown>> | null;

/**
 * Configuration for {@link useReactives}.
 *
 * @template M The model type extending Model.
 */
export type ReactivesConfig<M extends Model> = {
  actions: object;
  model: M;
  state: React.RefObject<State<M>>;
  checksums: React.RefObject<Map<symbol, string | null>>;
  unicast: EventEmitter;
};

/**
 * Configuration for {@link usePollings}.
 */
export type PollingsConfig = {
  actions: object;
  snapshot: DecoratorContext<Model>;
  unicast: EventEmitter;
};

/**
 * Configuration for {@link useLifecycle}.
 */
export type LifecycleConfig = {
  unicast: EventEmitter;
  regulator: React.RefObject<Regulator>;
};
