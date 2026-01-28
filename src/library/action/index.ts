import {
  HandlerPayload,
  DistributedPayload,
  Distribution,
  ChanneledAction,
  Brand,
  Filter,
} from "../types/index.ts";
import type { ActionId } from "../boundary/components/tasks/types.ts";
import { config } from "../utils/index.ts";
import { G } from "@mobily/ts-belt";

/**
 * Interface for the Action factory function.
 */
type ActionFactory = {
  /**
   * Creates a new unicast action with the given name.
   * @template P The payload type for the action.
   * @template C The channel type for channeled dispatches (defaults to never).
   * @param name The action name, used for debugging purposes.
   * @returns A typed action object.
   */
  <P = never, C extends Filter = never>(name: string): HandlerPayload<P, C>;

  /**
   * Creates a new action with the specified distribution mode.
   * @template P The payload type for the action.
   * @template C The channel type for channeled dispatches (defaults to never).
   * @param name The action name, used for debugging purposes.
   * @param distribution The distribution mode (Unicast or Broadcast).
   * @returns A typed action object (DistributedPayload if Broadcast).
   */
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution.Broadcast,
  ): DistributedPayload<P, C>;
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution.Unicast,
  ): HandlerPayload<P, C>;
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution,
  ): HandlerPayload<P, C> | DistributedPayload<P, C>;
};

/**
 * Creates a new action with a given payload type, optional channel type, and optional distribution mode.
 *
 * Actions are strongly typed identifiers used to dispatch and handle state changes.
 * By default, actions use `Distribution.Unicast` (local to the defining component).
 * Use `Distribution.Broadcast` for actions that need to be shared across components.
 *
 * When a channel type is specified, the action becomes callable to create channeled dispatches:
 * - `Action({ UserId: 5 })` creates a channeled action targeting that specific channel
 * - Plain `Action` (uncalled) broadcasts to all handlers
 *
 * @template P The type of the payload that the action will carry.
 * @template C The type of the channel for channeled dispatches (defaults to never).
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
 *   // Action with channel support for targeted dispatches
 *   static UserUpdated = Action<User, { UserId: number }>("UserUpdated");
 *
 *   // Broadcast action - can be consumed across components
 *   static Counter = Action<number>("Counter", Distribution.Broadcast);
 * }
 *
 * // Usage
 * actions.dispatch(Actions.Reset);
 * actions.dispatch(Actions.Increment, 5);
 * actions.dispatch(Actions.UserUpdated, user);                    // broadcast to all
 * actions.dispatch(Actions.UserUpdated({ UserId: 5 }), user);     // channeled dispatch
 * actions.consume(Actions.Counter, (box) => box.value);
 * ```
 */
export const Action = <ActionFactory>(<unknown>(<
  P = never,
  C extends Filter = never,
>(
  name: string,
  distribution: Distribution = Distribution.Unicast,
): HandlerPayload<P, C> | DistributedPayload<P, C> => {
  const symbol =
    distribution === Distribution.Broadcast
      ? Symbol(`${config.distributedActionPrefix}${name}`)
      : Symbol(`${config.actionPrefix}${name}`);

  // Create a callable function that produces channeled actions
  const action = function (channel: C): ChanneledAction<P, C> {
    return {
      [Brand.Action]: symbol,
      [Brand.Payload]: <P>undefined,
      [Brand.Channel]: channel,
      channel,
    };
  };

  // Attach the action symbol and brand keys
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Action, {
    value: symbol,
    enumerable: false,
  });
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Payload, {
    value: undefined,
    enumerable: false,
  });
  if (distribution === Distribution.Broadcast) {
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Distributed, {
      value: true,
      enumerable: false,
    });
  }

  return <HandlerPayload<P, C> | DistributedPayload<P, C>>action;
}));

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
export function getActionSymbol(action: ActionId | object): ActionId {
  if (G.isString(action)) return action;
  if (typeof action === "symbol") return action;
  // Check for Brand.Action property on objects or functions
  if (
    (G.isObject(action) || typeof action === "function") &&
    Brand.Action in action
  ) {
    return (<{ [Brand.Action]: symbol }>action)[Brand.Action];
  }
  return <ActionId>(<unknown>action);
}

/**
 * Checks whether an action is a distributed action.
 * Distributed actions are broadcast to all mounted components that have defined a handler for them.
 *
 * @param action The action to check.
 * @returns True if the action is a distributed action, false otherwise.
 */
export function isDistributedAction(action: ActionId | object): boolean {
  // Handle raw string/symbol (legacy or internal)
  if (G.isString(action))
    return action.startsWith(config.distributedActionPrefix);
  if (typeof action === "symbol")
    return (
      action.description?.startsWith(config.distributedActionPrefix) ?? false
    );

  // Handle action object, function, or channeled action
  // Note: G.isObject returns false for functions, so we check typeof explicitly
  if (G.isObject(action) || typeof action === "function") {
    // Check for Brand.Distributed brand
    if (
      Brand.Distributed in action &&
      (<{ [Brand.Distributed]: boolean }>action)[Brand.Distributed]
    ) {
      return true;
    }
    // Fall back to checking the underlying symbol
    if (Brand.Action in action) {
      const actionSymbol = (<{ [Brand.Action]: symbol }>action)[Brand.Action];
      return (
        actionSymbol.description?.startsWith(config.distributedActionPrefix) ??
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
export function getName(action: ActionId | object): string {
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
  action: ActionId | ChanneledAction | object,
): action is ChanneledAction {
  return G.isObject(action) && Brand.Channel in action && "channel" in action;
}
