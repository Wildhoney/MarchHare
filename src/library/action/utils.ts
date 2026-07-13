import {
  ChanneledAction,
  Brand,
  BrandedAction,
  BrandedBroadcast,
  BrandedMulticast,
  AnyAction,
  OmnicastPayload,
  ReactiveBinding,
  Schema,
} from "../types/index.ts";
import type { ActionId } from "../boundary/components/tasks/types.ts";
import { describe } from "../utils.ts";
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
 * getActionSymbol(Increment); // Symbol(march-hare.action/Increment)
 * getActionSymbol(Increment({ UserId: 5 })); // Symbol(march-hare.action/Increment)
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
    return (
      action.startsWith(describe.broadcast()) ||
      action.startsWith(describe.omnicast())
    );

  if (isSymbol(action))
    return (
      (action.description?.startsWith(describe.broadcast()) ?? false) ||
      (action.description?.startsWith(describe.omnicast()) ?? false)
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
        (actionSymbol.description?.startsWith(describe.broadcast()) ?? false) ||
        (actionSymbol.description?.startsWith(describe.omnicast()) ?? false)
      );
    }
  }

  return false;
}

/**
 * Checks whether an action is an omnicast action &mdash; a broadcast
 * action declared with `Distribution.Omnicast(schema?)` that additionally
 * travels between clients when the App is configured with an `sse`
 * endpoint.
 *
 * @param action The action to check.
 * @returns True if the action is an omnicast action, false otherwise.
 */
export function isOmnicastAction(action: AnyAction): boolean {
  if (G.isString(action)) return action.startsWith(describe.omnicast());

  if (isSymbol(action))
    return action.description?.startsWith(describe.omnicast()) ?? false;

  if (G.isObject(action) || G.isFunction(action)) {
    if (Brand.Omnicast in action) return true;

    if (Brand.Action in action) {
      const actionSymbol = (<BrandedAction>action)[Brand.Action];
      return actionSymbol.description?.startsWith(describe.omnicast()) ?? false;
    }
  }

  return false;
}

/**
 * Reads the runtime schema off an omnicast action; `null` when the action
 * was declared without a payload or is not an omnicast action at all.
 *
 * @param action The action to read the schema from.
 * @returns The Zod-style schema supplied at declaration time, or `null`.
 */
export function schemaOf(action: AnyAction): null | Schema<unknown> {
  if (
    (G.isObject(action) || G.isFunction(action)) &&
    Brand.Omnicast in action
  ) {
    return (<OmnicastPayload<unknown>>action)[Brand.Omnicast];
  }
  return null;
}

/**
 * Extracts the action name from an action.
 *
 * Parses regular actions (`march-hare.action/Name`), distributed actions
 * (`march-hare.action/distributed/Name`), and lifecycle actions
 * (`march-hare.action.lifecycle/Name`) to extract just the name portion.
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
 *
 * const Mount = Lifecycle.Mount();
 * getName(Mount); // "Mount"
 *
 * const User = Lifecycle.Reactive<User>("User");
 * getName(User); // "User"
 * ```
 */
export function getName(action: AnyAction): string {
  const symbol = getActionSymbol(action);
  const description = G.isString(symbol) ? symbol : (symbol.description ?? "");
  const recognised =
    description.startsWith(describe.action()) ||
    description.startsWith(describe.lifecycle());
  if (!recognised) return "unknown";
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
 * Checks if the given action is a reactive binding (result of calling a
 * `Lifecycle.Reactive` static with a value).
 *
 * @param action - The action to check
 * @returns `true` if the action is a reactive binding carrying a bound value
 *
 * @example
 * ```ts
 * const User = Lifecycle.Reactive<User>("User");
 *
 * isReactiveBinding(User); // false
 * isReactiveBinding(User(user)); // true
 * ```
 */
export function isReactiveBinding(
  action: AnyAction,
): action is ReactiveBinding {
  return G.isObject(action) && Brand.Reactive in action && "value" in action;
}

/**
 * Extracts the lifecycle type from an action's symbol description.
 *
 * Returns the lifecycle name (`"Mount"`, `"Paint"`, `"Unmount"`, `"Error"`,
 * `"Update"`) when the action symbol's description starts with the lifecycle
 * prefix, or `null` for non-lifecycle actions.
 *
 * @param action The action to inspect.
 * @returns The lifecycle name, or `null` if not a lifecycle action.
 *
 * @example
 * ```typescript
 * class Actions {
 *   static Mount = Lifecycle.Mount();
 * }
 *
 * getLifecycleType(Actions.Mount); // "Mount"
 * getLifecycleType(Action("Increment")); // null
 * ```
 */
export function getLifecycleType(action: AnyAction): string | null {
  const symbol = getActionSymbol(action);
  const description = isSymbol(symbol) ? (symbol.description ?? "") : symbol;
  if (!description.startsWith(describe.lifecycle())) return null;
  return description.slice(describe.lifecycle().length) || null;
}

/**
 * Checks whether an action is a multicast action.
 * Multicast actions are dispatched to all components within a named scope boundary.
 *
 * @param action The action to check.
 * @returns True if the action is a multicast action, false otherwise.
 */
export function isMulticastAction(action: AnyAction): boolean {
  if (G.isString(action)) return action.startsWith(describe.multicast());

  if (isSymbol(action))
    return action.description?.startsWith(describe.multicast()) ?? false;

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
        actionSymbol.description?.startsWith(describe.multicast()) ?? false
      );
    }
  }

  return false;
}
