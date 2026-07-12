import { Action } from "../action/index.ts";
import {
  Brand,
  Distribution,
  type OmnicastPayload,
  type Schema,
} from "../types/index.ts";

/**
 * Creates an omnicast action &mdash; a broadcast action that is permitted
 * to travel between clients over an SSE bridge, the same way `Action(name,
 * Distribution.Broadcast)` creates an event that travels between
 * components. Within the local `<Boundary>` an omnicast action behaves
 * exactly like a broadcast: subscribe with `useAction`, render with
 * `stream`, resolve with `resolution`.
 *
 * The payload type is inferred from the supplied schema rather than a
 * generic, so the compile-time type and the runtime validator can never
 * drift apart. Any Zod-style validator works &mdash; the only contract is
 * a `parse(value)` method that returns the typed value or throws. The SSE
 * bridge runs `parse` over every envelope arriving from the wire and
 * rejects the dispatch when validation fails, so a misbehaving peer cannot
 * push malformed payloads into your handlers.
 *
 * Omit the schema for payloadless events.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * export namespace Payload {
 *   export const Cat = z.object({ id: z.string(), name: z.string() });
 *   export type Cat = z.infer<typeof Cat>;
 * }
 *
 * export namespace Omnicast {
 *   export class Cat {
 *     static Adopted = OmnicastAction("Cat.Adopted", Payload.Cat);
 *   }
 *   export class Cattery {
 *     static Opened = OmnicastAction("Cattery.Opened");
 *   }
 * }
 * ```
 */
export function Omnicast<K extends string>(name?: K): OmnicastPayload<never, K>;
export function Omnicast<T, K extends string = string>(
  name: K | undefined,
  schema: Schema<T>,
): OmnicastPayload<T, K>;
export function Omnicast<T, K extends string = string>(
  name?: K,
  schema?: Schema<T>,
): OmnicastPayload<T, K> {
  const action = Action<T, never, K>(name, Distribution.Broadcast);
  Object.defineProperty(action, Brand.Omnicast, {
    value: schema ?? null,
    enumerable: false,
  });
  return <OmnicastPayload<T, K>>action;
}

/**
 * Narrows any value to an omnicast action by the presence of the omnicast
 * brand. The SSE bridge uses this both to filter the wire class and to
 * refuse plain broadcast actions at dispatch time.
 */
export function isOmnicastAction(
  value: unknown,
): value is OmnicastPayload<unknown> {
  if (value === null) return false;
  if (typeof value !== "object" && typeof value !== "function") return false;
  return Brand.Omnicast in value;
}

/**
 * Reads the runtime schema off an omnicast action; `null` when the action
 * was declared without a payload.
 */
export function schemaOf(
  action: OmnicastPayload<unknown>,
): null | Schema<unknown> {
  return action[Brand.Omnicast];
}
