import { Payload } from "../types/index.ts";
import type { Action } from "../regulator/types.ts";
import { G } from "@mobily/ts-belt";

/**
 * Defines a new action with a given payload type.
 *
 * @template T The type of the payload that the action will carry.
 * @param name An optional name for the action, used for debugging purposes.
 * @returns A new action symbol.
 */
export function createAction<T = never>(
  name: string = "anonymous",
): Payload<T> {
  return <Payload<T>>Symbol(`chizu.action/${name}`);
}

/**
 * Defines a new distributed action with a given payload type.
 * Distributed actions are broadcast to all mounted components that have defined a handler for them.
 *
 * @template T The type of the payload that the action will carry.
 * @param name An optional name for the action, used for debugging purposes.
 * @returns A new distributed action symbol.
 */
export function createDistributedAction<T = never>(
  name: string = "anonymous",
): Payload<T> {
  return <Payload<T>>Symbol(`chizu.action/distributed/${name}`);
}

/**
 * Checks whether an action is a distributed action.
 * Distributed actions are broadcast to all mounted components that have defined a handler for them.
 *
 * @param action The action to check.
 * @returns True if the action is a distributed action, false otherwise.
 */
export function isDistributedAction(action: Action): boolean {
  if (G.isString(action)) return action.startsWith("chizu.action/distributed/");
  return action.description?.startsWith("chizu.action/distributed/") ?? false;
}

/**
 * Extracts the action name from an action symbol.
 *
 * Parses both regular actions (`Symbol(chizu.action/Name)`) and
 * distributed actions (`Symbol(chizu.action/distributed/Name)`)
 * to extract just the name portion.
 *
 * @param action The action symbol to extract the name from.
 * @returns The extracted action name, or "unknown" if parsing fails.
 *
 * @example
 * ```typescript
 * const action = createAction("Increment");
 * getActionName(action); // "Increment"
 *
 * const distributed = createDistributedAction("SignedOut");
 * getActionName(distributed); // "SignedOut"
 * ```
 */
export function getActionName(action: Action): string {
  const description = G.isString(action) ? action : (action.description ?? "");
  if (!description.startsWith("chizu.action/")) return "unknown";
  const name = description.slice(description.lastIndexOf("/") + 1);
  return name || "unknown";
}
