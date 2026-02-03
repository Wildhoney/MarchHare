import {
  ChanneledAction,
  Brand,
  BrandedAction,
  BrandedBroadcast,
  BrandedMulticast,
  AnyAction,
} from "../types/index.ts";
import type { ActionId } from "../boundary/components/tasks/types.ts";
import { config } from "../utils/index.ts";
import { G } from "@mobily/ts-belt";

const isSymbol = (value: unknown): value is symbol => typeof value === "symbol";

/**
 * Extracts the underlying symbol from an action or channeled action.
 * This symbol is used as the event emitter key for dispatching.
 *
 * @param action The action or channeled action to extract the symbol from.
 * @returns The underlying symbol, or the action itself if it's already a symbol/string.
 *
 * @example
 * ```typescript
 * const Increment = Action<number>("Increment");
 * getActionSymbol(Increment); // Symbol(chizu.action/Increment)
 * getActionSymbol(Increment({ UserId: 5 })); // Symbol(chizu.action/Increment)
 * ```
 */
export function getActionSymbol(action: AnyAction): ActionId {
  if (G.isString(action)) return action;
  if (isSymbol(action)) return action;
  if ((G.isObject(action) || G.isFunction(action)) && Brand.Action in action) {
    return (<BrandedAction>action)[Brand.Action];
  }
  return <ActionId>(<unknown>action);
}

/**
 * Checks whether an action is a broadcast action.
 * Broadcast actions are sent to all mounted components that have defined a handler for them.
 *
 * @param action The action to check.
 * @returns True if the action is a broadcast action, false otherwise.
 */
export function isBroadcastAction(action: AnyAction): boolean {
  if (G.isString(action))
    return action.startsWith(config.broadcastActionPrefix);

  if (isSymbol(action))
    return (
      action.description?.startsWith(config.broadcastActionPrefix) ?? false
    );

  if (G.isObject(action) || G.isFunction(action)) {
    if (
      Brand.Broadcast in action &&
      (<BrandedBroadcast>action)[Brand.Broadcast]
    ) {
      return true;
    }

    if (Brand.Action in action) {
      const actionSymbol = (<BrandedAction>action)[Brand.Action];
      return (
        actionSymbol.description?.startsWith(config.broadcastActionPrefix) ??
        false
      );
    }
  }

  return false;
}

/**
 * Extracts the action name from an action.
 *
 * Parses both regular actions (`chizu.action/Name`) and
 * distributed actions (`chizu.action/distributed/Name`)
 * to extract just the name portion.
 *
 * @param action The action to extract the name from.
 * @returns The extracted action name, or "unknown" if parsing fails.
 *
 * @example
 * ```typescript
 * const Increment = Action("Increment");
 * getName(Increment); // "Increment"
 *
 * const SignedOut = Action("SignedOut", Distribution.Broadcast);
 * getName(SignedOut); // "SignedOut"
 * ```
 */
export function getName(action: AnyAction): string {
  const symbol = getActionSymbol(action);
  const description = G.isString(symbol) ? symbol : (symbol.description ?? "");
  if (!description.startsWith(config.actionPrefix)) return "unknown";
  const name = description.slice(description.lastIndexOf("/") + 1);
  return name || "unknown";
}

/**
 * Checks if the given action is a channeled action (result of calling `Action(channel)`).
 *
 * @param action - The action to check
 * @returns `true` if the action is a channeled action with a channel property, `false` otherwise
 *
 * @example
 * ```ts
 * const UserUpdated = Action<User, { UserId: number }>("UserUpdated");
 *
 * isChanneledAction(UserUpdated); // false
 * isChanneledAction(UserUpdated({ UserId: 1 })); // true
 * ```
 */
export function isChanneledAction(
  action: AnyAction,
): action is ChanneledAction {
  return G.isObject(action) && Brand.Channel in action && "channel" in action;
}

/**
 * Checks whether an action is a multicast action.
 * Multicast actions are dispatched to all components within a named scope boundary.
 *
 * @param action The action to check.
 * @returns True if the action is a multicast action, false otherwise.
 */
export function isMulticastAction(action: AnyAction): boolean {
  if (G.isString(action))
    return action.startsWith(config.multicastActionPrefix);

  if (isSymbol(action))
    return (
      action.description?.startsWith(config.multicastActionPrefix) ?? false
    );

  if (G.isObject(action) || G.isFunction(action)) {
    if (
      Brand.Multicast in action &&
      (<BrandedMulticast>action)[Brand.Multicast]
    ) {
      return true;
    }

    if (Brand.Action in action) {
      const actionSymbol = (<BrandedAction>action)[Brand.Action];
      return (
        actionSymbol.description?.startsWith(config.multicastActionPrefix) ??
        false
      );
    }
  }

  return false;
}
