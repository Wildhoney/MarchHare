import { Action, Payload } from "../types";

/**
 * Defines a new action with a given payload type.
 *
 * @template T The type of the payload that the action will carry.
 * @param {string} [name] An optional name for the action, used for debugging purposes.
 * @returns {Payload<T>} A new action object.
 */
export function createAction<T = never>(
  name: string = "anonymous",
): Payload<T> {
  return <Payload<T>>Symbol(`chizu.action/${name}`);
}

/**
 * Defines a new distributed action with a given payload type.
 * Distributed actions can be shared across different modules.
 *
 * @template T The type of the payload that the action will carry.
 * @param {string} [name] An optional name for the action, used for debugging purposes.
 * @returns {Payload<T>} A new distributed action object.
 */
export function createDistributedAction<T = never>(
  name: string = "anonymous",
): Payload<T> {
  return <Payload<T>>Symbol(`chizu.action/distributed/${name}`);
}

export function isDistributedAction(action: Action): boolean {
  return action.toString().startsWith("Symbol(chizu.action/distributed/");
}
