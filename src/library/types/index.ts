/* eslint-disable @typescript-eslint/no-explicit-any */
import { Operation } from "immertation";
import { Process, Inspect } from "immertation";

export const context = Symbol("chizu.action.context");

/**
 * Lifecycle actions that trigger at specific points in a component's lifecycle.
 * Define handlers for these in your actions class to respond to lifecycle events.
 *
 * @example
 * ```ts
 * class {
 *   [Lifecycle.Mount] = mountAction;
 *   [Lifecycle.Error] = errorAction;
 *   [Lifecycle.Unmount] = unmountAction;
 * }
 * ```
 */
export class Lifecycle {
  /** Triggered once when the component mounts (`useLayoutEffect`). */
  static Mount = Symbol("chizu.action.lifecycle/Mount");
  /** Triggered after the component renders (`useEffect`). */
  static Node = Symbol("chizu.action.lifecycle/Node");
  /** Triggered when the component unmounts. */
  static Unmount = Symbol("chizu.action.lifecycle/Unmount");
  /** Triggered when an action throws an error. Receives `ErrorDetails` as payload. */
  static Error = Symbol("chizu.action.lifecycle/Error");
}

export type Pk<T> = undefined | symbol | T;

export type Task = PromiseWithResolvers<void>;

export type Model<M = Record<string, unknown>> = M;

export const PayloadKey = Symbol("payload");

export type Payload<T = unknown> = symbol & { [PayloadKey]: T };

type PayloadType<A> = A extends Payload<infer P> ? P : never;

type IsAsync<F> = F extends (...args: any[]) => Promise<any> ? true : false;

type AssertSync<F> =
  IsAsync<F> extends true
    ? "Error: async functions are not allowed in produce"
    : F;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type Props = Record<string, unknown>;

export type Action = symbol | string;

export type ActionsClass<AC extends Record<string, Payload<any>>> = {
  new (): unknown;
} & AC;

export type ActionInstance<
  M extends Model,
  AC extends ActionsClass<any>,
> = UnionToIntersection<
  AC[keyof AC] extends infer P
    ? P extends symbol
      ? P extends Payload<infer T>
        ? {
            [K in P]: ((
              context: Context<M, AC>,
              payload: T,
            ) => void | Promise<void>) & {
              payload: T;
            };
          }
        : never
      : never
    : never
>;

export type Result = {
  processes: Set<Process>;
};

export type OperationFunction = <T>(value: T, process: Process) => T;

export type Context<M extends Model, AC extends ActionsClass<any>> = {
  model: M;
  signal: AbortSignal;
  actions: {
    produce<F extends (model: M) => void>(ƒ: F & AssertSync<F>): M;
    dispatch<A extends AC[keyof AC] & Payload<any>>(
      ...args: [PayloadType<A>] extends [never] ? [A] : [A, PayloadType<A>]
    ): void;
    annotate<T>(operation: Operation, value: T): T;
  };
  [context]: {
    controller: AbortController;
  };
};

export type Actions<
  M extends Model,
  AC extends ActionsClass<any>,
> = new () => ActionInstance<M, AC>;

export type UseActions<M extends Model, AC extends ActionsClass<any>> = [
  M,
  {
    dispatch<A extends AC[keyof AC] & Payload<any>>(
      ...args: [PayloadType<A>] extends [never] ? [A] : [A, PayloadType<A>]
    ): void;
    inspect: Inspect<M>;
  },
];
