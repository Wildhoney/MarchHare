import { ActionsClass, Context, Model, Payload } from "../types/index.ts";

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
 * Represents a reactive binding that triggers an action when dependencies change.
 *
 * Created by the `@use.reactive()` decorator and stored in a WeakMap keyed by
 * action class instance. The hook's useEffect iterates over these entries each
 * render, checksumming the dependencies and emitting the action if changed.
 *
 * @template P The payload type for this reactive binding.
 *
 * @example
 * ```ts
 * // Action WITH payload - separate dependencies and payload getter
 * // @use.reactive(Actions.FetchUser, () => [userId], () => ({ userId, includeDetails: true }))
 * {
 *   action: Actions.FetchUser,
 *   getDependencies: () => [userId],      // Called every render for change detection
 *   getPayload: () => ({ userId, ... }),  // Called at dispatch time for fresh values
 * }
 *
 * // Action WITHOUT payload - dependencies only for triggering
 * // @use.reactive(Actions.Increment, () => [count])
 * {
 *   action: Actions.Increment,
 *   getDependencies: () => [count],
 *   getPayload: undefined,
 * }
 * ```
 */
export type Entry<P = unknown> = {
  /** The action symbol to emit when dependencies change. Carries payload type via branding. */
  action: Payload<P>;
  /** Function returning primitive dependencies. Called each render; return value is checksummed for change detection. */
  getDependencies: () => Primitive[];
  /** Function returning the payload. Called at dispatch time to get fresh values. Undefined for no-payload actions. */
  getPayload: (() => P) | undefined;
};

/** Collection of reactive bindings for an action class instance. */
export type Entries = Set<Entry>;
