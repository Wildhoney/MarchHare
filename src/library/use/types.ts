import { ActionsClass, Context, Model } from "../types";

export type Field = ClassFieldDecoratorContext<
  any,
  Context<Model, ActionsClass<any>>
>;

export type Args = Context<Model, ActionsClass<any>>;
