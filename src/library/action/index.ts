import {
  HandlerPayload,
  BroadcastPayload,
  MulticastPayload,
  Distribution,
  ChanneledAction,
  Brand,
  Filter,
} from "../types/index.ts";
import { config } from "../utils/index.ts";

export {
  getActionSymbol,
  isBroadcastAction,
  isMulticastAction,
  getName,
  isChanneledAction,
} from "./utils.ts";

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
   * @param distribution The distribution mode (Unicast, Broadcast, or Multicast).
   * @returns A typed action object (BroadcastPayload if Broadcast, MulticastPayload if Multicast).
   */
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution.Broadcast,
  ): BroadcastPayload<P, C>;
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution.Multicast,
  ): MulticastPayload<P, C>;
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution.Unicast,
  ): HandlerPayload<P, C>;
  <P = never, C extends Filter = never>(
    name: string,
    distribution: Distribution,
  ): HandlerPayload<P, C> | BroadcastPayload<P, C> | MulticastPayload<P, C>;
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
): HandlerPayload<P, C> | BroadcastPayload<P, C> | MulticastPayload<P, C> => {
  const symbol =
    distribution === Distribution.Broadcast
      ? Symbol(`${config.broadcastActionPrefix}${name}`)
      : distribution === Distribution.Multicast
        ? Symbol(`${config.multicastActionPrefix}${name}`)
        : Symbol(`${config.actionPrefix}${name}`);

  const action = function (channel: C): ChanneledAction<P, C> {
    return {
      [Brand.Action]: symbol,
      [Brand.Payload]: <P>undefined,
      [Brand.Channel]: channel,
      channel,
    };
  };

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
    Object.defineProperty(action, Brand.Broadcast, {
      value: true,
      enumerable: false,
    });
  }
  if (distribution === Distribution.Multicast) {
    // eslint-disable-next-line fp/no-mutating-methods
    Object.defineProperty(action, Brand.Multicast, {
      value: true,
      enumerable: false,
    });
  }

  return <
    HandlerPayload<P, C> | BroadcastPayload<P, C> | MulticastPayload<P, C>
  >action;
}));
