import { context } from "../types/index.ts";
import { Internals, Entries, PollEntries } from "./types.ts";

export { context };

export const internals = new WeakMap<object, Internals>();

export const entries = new WeakMap<object, Entries>();

export const polls = new WeakMap<object, PollEntries>();

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
