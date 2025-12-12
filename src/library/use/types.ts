import { ActionsClass, Context, Model, Payload } from "../types";

export type Field = ClassFieldDecoratorContext<
  object,
  Context<Model, ActionsClass<Record<string, Payload>>>
>;

export type Args = Context<Model, ActionsClass<Record<string, Payload>>>;

export type Instance = Record<string | symbol, unknown>;

export type Method = (args: Args) => Promise<unknown>;

export type ContextValue = { controller: AbortController };
