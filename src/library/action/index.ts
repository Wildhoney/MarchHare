import { Payload, DistributedPayload, Distribution } from "../types/index.ts";
import type { Action as ActionType } from "../regulator/types.ts";
import { G } from "@mobily/ts-belt";

/**
 * Interface for the Action factory function.
 */
type ActionFactory = {
  /**
   * Creates a new unicast action with the given name.
   * @template T The payload type for the action.
   * @param name The action name, used for debugging purposes.
   * @returns A typed action symbol.
   */
  <T = never>(name: string): Payload<T>;

  /**
   * Creates a new action with the specified distribution mode.
   * @template T The payload type for the action.
   * @param distribution The distribution mode (Unicast or Broadcast).
   * @param name The action name, used for debugging purposes.
   * @returns A typed action symbol (DistributedPayload if Broadcast).
   */
  <T = never>(
    distribution: Distribution.Broadcast,
    name: string,
  ): DistributedPayload<T>;
  <T = never>(distribution: Distribution.Unicast, name: string): Payload<T>;
  <T = never>(
    distribution: Distribution,
    name: string,
  ): Payload<T> | DistributedPayload<T>;
};

/**
 * Creates a new action with a given payload type and optional distribution mode.
 *
 * Actions are strongly typed identifiers used to dispatch and handle state changes.
 * By default, actions use `Distribution.Unicast` (local to the defining component).
 * Use `Distribution.Broadcast` for actions that need to be shared across components.
 *
 * @template T The type of the payload that the action will carry.
 *
 * @example
 * ```ts
 * export class Actions {
 *   // Unicast action with no payload
 *   static Reset = Action("Reset");
 *
 *   // Unicast action with typed payload
 *   static Increment = Action<number>("Increment");
 *
 *   // Broadcast action - can be consumed across components
 *   static Counter = Action<number>(Distribution.Broadcast, "Counter");
 * }
 *
 * // Usage
 * actions.dispatch(Actions.Reset);
 * actions.dispatch(Actions.Increment, 5);
 * actions.consume(Actions.Counter, (box) => box.value);
 * ```
 */
export const Action = <ActionFactory>(<unknown>(<T = never>(
  distributionOrName: Distribution | string,
  name?: string,
): Payload<T> | DistributedPayload<T> => {
  const isDistributionFirst = Object.values(Distribution).includes(
    <Distribution>distributionOrName,
  );

  const distribution = isDistributionFirst
    ? <Distribution>distributionOrName
    : Distribution.Unicast;
  const actionName = isDistributionFirst
    ? (name ?? "anonymous")
    : distributionOrName;

  return distribution === Distribution.Broadcast
    ? <DistributedPayload<T>>Symbol(`chizu.action/distributed/${actionName}`)
    : <Payload<T>>Symbol(`chizu.action/${actionName}`);
}));

/**
 * Checks whether an action is a distributed action.
 * Distributed actions are broadcast to all mounted components that have defined a handler for them.
 *
 * @param action The action to check.
 * @returns True if the action is a distributed action, false otherwise.
 */
export function isDistributedAction(action: ActionType): boolean {
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
 * const Increment = Action("Increment");
 * getActionName(Increment); // "Increment"
 *
 * const SignedOut = Action(Distribution.Broadcast, "SignedOut");
 * getActionName(SignedOut); // "SignedOut"
 * ```
 */
export function getActionName(action: ActionType): string {
  const description = G.isString(action) ? action : (action.description ?? "");
  if (!description.startsWith("chizu.action/")) return "unknown";
  const name = description.slice(description.lastIndexOf("/") + 1);
  return name || "unknown";
}
