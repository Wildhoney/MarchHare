import { context } from "../types/index.ts";
import { Internals, Entries } from "./types.ts";

export { context };

export const internals = new WeakMap<object, Internals>();

export const entries = new WeakMap<object, Entries>();

/**
 * Extracts a readable name from an action symbol or string.
 *
 * @param name The action name as a symbol or string.
 * @returns A human-readable string representation of the action name.
 */
export function actionName(name: string | symbol): string {
  if (typeof name === "symbol") {
    return name.description ?? "unknown";
  }
  return name;
}
