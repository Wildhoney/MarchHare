import { ContextValue } from "./types";

export const contexts = new WeakMap<object, ContextValue>();

export const context = Symbol("chizu.action.context");
