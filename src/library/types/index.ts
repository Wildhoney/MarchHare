import type { Decorate } from "immertation";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class Draft<T> {
  constructor(public value: T) {}
}

export class State {
  static Operation = {
    Adding: 1,
    Removing: 2,
    Updating: 4,
    Moving: 8,
    Replacing: 16,
    Sorting: 32,
  };

  static Draft<T>(value: T): Draft<T> {
    return new Draft(value);
  }
}

export class Lifecycle {
  static Mount = Symbol("lifecycle/mount");
  static Node = Symbol("lifecycle/node");
  static Derive = Symbol("lifecycle/derive");
  static Error = Symbol("lifecycle/error");
  static Unmount = Symbol("lifecycle/unmount");
}

export type Pk<T> = undefined | symbol | T;

export type Task = PromiseWithResolvers<void>;

export type Process = symbol;

export type Operation = number;

export type Operations<T> = (Operation | Draft<T>)[];

export type Model<M = Record<string, unknown>> = M;

export const PayloadKey = Symbol("payload");

export type Payload<T = unknown> = symbol & { [PayloadKey]: T };

type PayloadType<A> = A extends Payload<infer P> ? P : never;

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

export type OperationFunction = <T>(value: T, process: Process) => T;

export type Context<M extends Model, AC extends ActionsClass<any>> = {
  model: M;
  signal: AbortSignal;
  actions: {
    produce(ƒ: (model: M) => void): M;
    dispatch<A extends AC[keyof AC] & Payload<any>>(
      ...args: [PayloadType<A>] extends [never] ? [A] : [A, PayloadType<A>]
    ): void;
    annotate<T>(operation: <V>(value: V, process: Process) => V, value: T): T;
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
    inspect: Decorate<M>;
  },
];
