import { Payload, DistributedPayload } from "../types/index.ts";
import type { Action } from "../regulator/types.ts";
import { G } from "@mobily/ts-belt";

/**
 * Defines a new local action with a given payload type.
 * Local actions are scoped to the component that defines them and cannot be consumed
 * by other components. Use `createDistributedAction()` for actions that need to be
 * shared across components via `actions.consume()`.
 *
 * @template T The type of the payload that the action will carry.
 * @param name An optional name for the action, used for debugging purposes.
 * @returns A new action symbol.
 *
 * @example
 * ```ts
 * const Increment = createAction<number>("Increment");
 *
 * // Dispatch within the same component
 * actions.dispatch(Increment, 5);
 * ```
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
 * Returns a `DistributedPayload<T>` which is required by `actions.consume()`. Local actions
 * created with `createAction()` cannot be consumed &ndash; this is enforced at compile-time.
 *
 * @template T The type of the payload that the action will carry.
 * @param name An optional name for the action, used for debugging purposes.
 * @returns A new distributed action symbol that can be used with `consume()`.
 *
 * @example
 * ```ts
 * const SignedOut = createDistributedAction<User>("SignedOut");
 *
 * // Can be consumed across components
 * actions.consume(SignedOut, (box) => <div>{box.value.name}</div>);
 * ```
 */
export function createDistributedAction<T = never>(
  name: string = "anonymous",
): DistributedPayload<T> {
  return <DistributedPayload<T>>Symbol(`chizu.action/distributed/${name}`);
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
