import {
  ActionsClass,
  Context,
  Model,
  Payload,
  Status,
} from "../types/index.ts";
import { Inspect } from "immertation";

/** Decorator context for class field decorators applied to action methods. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Field = ClassFieldDecoratorContext<object, (...args: any[]) => any>;

/** Action handler arguments containing context with model, signal, and action helpers. */
export type Args = Context<Model, ActionsClass<Record<string, Payload>>>;

/** Generic instance type for action classes with string or symbol keys. */
export type Instance = Record<string | symbol, unknown>;

/** Async action handler function signature. */
export type Method = (args: Args) => Promise<unknown>;

/** Internal state for decorators like `@use.supplant()` that manage AbortControllers. */
export type Internals = { controller: AbortController };

/** Primitive types that can be used as reactive dependencies for change detection. */
export type Primitive = string | number | boolean | null | undefined | symbol;

/**
 * Function that returns an array of primitive values used for reactive change detection.
 *
 * Called on every render by `@use.reactive()` to determine if the action should be triggered.
 * The returned array is checksummed; when the checksum changes, the decorated action is dispatched.
 *
 * @returns Array of primitives representing the current dependency state.
 *
 * @example
 * ```ts
 * // Single dependency
 * const getDeps: Dependencies = () => [userId];
 *
 * // Multiple dependencies
 * const getDeps: Dependencies = () => [userId, filters.length, isActive];
 * ```
 */
export type Dependencies = () => Primitive[];

/**
 * Context provided to decorator callback functions (reactive, poll).
 *
 * @template M The model type. The inspect type is automatically derived as `Inspect<M>`.
 */
export type DecoratorContext<M = unknown> = {
  /** The current model state. */
  model: M;
  /** Access to Immertation's annotation inspection system. */
  inspect: Inspect<M>;
};

/**
 * Represents a reactive binding that triggers an action when dependencies change.
 *
 * Created by the `@use.reactive()` decorator and stored in a WeakMap keyed by
 * action class instance. The hook's useEffect iterates over these entries each
 * render, checksumming the dependencies and emitting the action if changed.
 *
 * @template P The payload type for this reactive binding.
 * @template M The model type for context access.
 *
 * @example
 * ```ts
 * // Action WITH payload - context-aware dependencies and payload
 * // @use.reactive(Actions.FetchUser, (context) => [context.model.userId], (context) => ({ userId: context.model.userId }))
 * {
 *   action: Actions.FetchUser,
 *   getDependencies: (context) => [context.model.userId],
 *   getPayload: (context) => ({ userId: context.model.userId }),
 * }
 *
 * // Action WITHOUT payload - context-aware dependencies only
 * // @use.reactive(Actions.Refresh, (context) => [context.model.filters.length])
 * {
 *   action: Actions.Refresh,
 *   getDependencies: (context) => [context.model.filters.length],
 *   getPayload: undefined,
 * }
 * ```
 */
export type Entry<P = unknown, M = unknown> = {
  /** The action symbol to emit when dependencies change. Carries payload type via branding. */
  action: Payload<P>;
  /** Function returning primitive dependencies. Receives context with current model. Called each render; return value is checksummed for change detection. */
  getDependencies: (context: DecoratorContext<M>) => Primitive[];
  /** Function returning the payload. Receives context with current model. Called at dispatch time to get fresh values. Undefined for no-payload actions. */
  getPayload: ((context: DecoratorContext<M>) => P) | undefined;
};

/** Collection of reactive bindings for an action class instance. */
export type Entries = Set<Entry>;

/**
 * Represents a poll binding that triggers an action at regular intervals.
 *
 * Created by the `@use.poll()` decorator and stored in a WeakMap keyed by
 * action class instance. The hook sets up intervals on mount and cleans
 * them up on unmount.
 *
 * @template P The payload type for this poll binding.
 * @template M The model type for context access.
 *
 * @example
 * ```ts
 * // Poll every 5 seconds with context-aware payload
 * // @use.poll(Actions.RefreshData, 5000, (context) => ({ userId: context.model.userId }))
 * {
 *   action: Actions.RefreshData,
 *   interval: 5000,
 *   getPayload: (context) => ({ userId: context.model.userId }),
 *   getStatus: () => Status.Play,
 * }
 *
 * // Poll with context-aware status (pause when count >= 10)
 * // @use.poll(Actions.Increment, 1000, (context) => context.model.count < 10 ? Status.Play : Status.Pause)
 * {
 *   action: Actions.Increment,
 *   interval: 1000,
 *   getPayload: undefined,
 *   getStatus: (context) => context.model.count < 10 ? Status.Play : Status.Pause,
 * }
 * ```
 */
export type PollEntry<P = unknown, M = unknown> = {
  /** The action symbol to emit at each interval. Carries payload type via branding. */
  action: Payload<P>;
  /** The polling interval in milliseconds. */
  interval: number;
  /** Function returning the payload. Receives context with current model. Undefined for no-payload actions. */
  getPayload: ((context: DecoratorContext<M>) => P) | undefined;
  /** Function returning the current status. Receives context with current model. */
  getStatus: (context: DecoratorContext<M>) => Status;
};

/** Collection of poll bindings for an action class instance. */
export type PollEntries = Set<PollEntry>;
