import {
  HandlerPayload,
  BroadcastPayload,
  MulticastPayload,
  Distribution,
  ChanneledAction,
  Brand,
  Filter,
} from "../types/index.ts";
import { describe } from "../utils.ts";

export {
  getActionSymbol,
  getLifecycleType,
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
   * Creates a new unicast action with an optional name.
   *
   * `K` is the literal type of the action name and is captured as a phantom
   * brand so `Action("A")` and `Action("B")` produce structurally-distinct
   * types. **Note:** when the caller supplies any explicit generic
   * (`Action<P>("Name")`), TypeScript fills `K` from its default and the
   * literal is lost. The Name brand still helps for `Action("Name")` calls
   * (e.g. lifecycle / no-payload actions) which is the most common source of
   * foreign-class collisions.
   *
   * Omitting the name produces an action whose symbol description has no
   * suffix. Symbol identity (and therefore dispatch routing) is unaffected
   * — names are only used for fault reporting and debugger readability.
   *
   * @template P The payload type for the action.
   * @template C The channel type for channeled dispatches.
   * @template K The literal type of the action name (inferred when no other
   *   generics are supplied; defaults to `string` otherwise).
   */
  <P = never, C extends Filter = never, K extends string = string>(
    name?: K,
  ): HandlerPayload<P, C, K>;

  /**
   * Creates a new action with the specified distribution mode.
   */
  <P = never, C extends Filter = never, K extends string = string>(
    name: K | undefined,
    distribution: Distribution.Broadcast,
  ): BroadcastPayload<P, C, K>;
  <P = never, C extends Filter = never, K extends string = string>(
    name: K | undefined,
    distribution: Distribution.Multicast,
  ): MulticastPayload<P, C, K>;
  <P = never, C extends Filter = never, K extends string = string>(
    name: K | undefined,
    distribution: Distribution.Unicast,
  ): HandlerPayload<P, C, K>;
  <P = never, C extends Filter = never, K extends string = string>(
    name: K | undefined,
    distribution: Distribution,
  ):
    | HandlerPayload<P, C, K>
    | BroadcastPayload<P, C, K>
    | MulticastPayload<P, C, K>;
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
 *   // Broadcast action - can be read across components
 *   static Counter = Action<number>("Counter", Distribution.Broadcast);
 * }
 *
 * // Usage
 * actions.dispatch(Actions.Reset);
 * actions.dispatch(Actions.Increment, 5);
 * actions.dispatch(Actions.UserUpdated, user);                    // broadcast to all
 * actions.dispatch(Actions.UserUpdated({ UserId: 5 }), user);     // channeled dispatch
 * actions.stream(Actions.Counter, (box) => box.value);
 * ```
 */
export const Action = <ActionFactory>(<unknown>(<
  P = never,
  C extends Filter = never,
>(
  name: string = "",
  distribution: Distribution = Distribution.Unicast,
): HandlerPayload<P, C> | BroadcastPayload<P, C> | MulticastPayload<P, C> => {
  const symbol =
    distribution === Distribution.Broadcast
      ? Symbol(describe.broadcast(name))
      : distribution === Distribution.Multicast
        ? Symbol(describe.multicast(name))
        : Symbol(describe.action(name));

  const action = function (channel: C): ChanneledAction<P, C> {
    const channeled: ChanneledAction<P, C> = {
      [Brand.Action]: symbol,
      [Brand.Payload]: <P>undefined,
      [Brand.Channel]: channel,
      [Brand.Name]: name,
      channel,
    };
    if (distribution === Distribution.Broadcast) {
      // eslint-disable-next-line fp/no-mutating-methods
      Object.defineProperty(channeled, Brand.Broadcast, {
        value: true,
        enumerable: false,
      });
    }
    return channeled;
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
  // eslint-disable-next-line fp/no-mutating-methods
  Object.defineProperty(action, Brand.Name, { value: name, enumerable: false });
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
