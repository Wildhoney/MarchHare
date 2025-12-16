import { ActionsClass, Context, Model, Payload } from "../types/index.ts";

export type Primitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | symbol
  | bigint;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Field = ClassFieldDecoratorContext<object, (...args: any[]) => any>;

export type Args = Context<Model, ActionsClass<Record<string, Payload>>>;

export type Instance = Record<string | symbol, unknown>;

export type Method = (args: Args) => Promise<unknown>;

export type Internals = { controller: AbortController };

export type Entry = {
  action: string | symbol;
  getDependencies(): Primitive[];
};

export type Entries = Entry[];
