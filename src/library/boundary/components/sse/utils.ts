import { G } from "@mobily/ts-belt";
import { getName, isOmnicastAction } from "../../../action/utils.ts";
import type { Actions, OmnicastPayload } from "../../../types/index.ts";

const depthLimit = 4;

/**
 * Finds the omnicast action whose name matches an incoming envelope,
 * walking nested classes and namespaces (e.g. `Omnicast.Cat.Adopted`) up
 * to a small fixed depth. Non-omnicast members and unknown names resolve
 * to `null`, so the configured actions act as an allow-list for what a
 * remote peer may dispatch into the local Boundary.
 */
export function lookup(
  actions: Actions,
  name: string,
  depth = 0,
): null | OmnicastPayload<unknown> {
  if (depth > depthLimit) return null;
  for (const candidate of Object.values(actions)) {
    if (isOmnicastAction(<OmnicastPayload<unknown>>candidate)) {
      if (getName(<OmnicastPayload<unknown>>candidate) === name)
        return <OmnicastPayload<unknown>>candidate;
      continue;
    }
    if (G.isObject(candidate) || G.isFunction(candidate)) {
      const nested = lookup(<Actions>candidate, name, depth + 1);
      if (G.isNotNullable(nested)) return nested;
    }
  }
  return null;
}

/**
 * Splits the desired tag set against the tags the server currently holds
 * for the connection, yielding the mutations required to align the server.
 * Used after every `connected` event so tag mutations survive the
 * automatic `EventSource` reconnect, which reverts the server to the
 * query-string tags.
 */
export function reconcile(
  desired: ReadonlySet<string>,
  held: readonly string[],
): { add: string[]; remove: string[] } {
  const current = new Set(held);
  return {
    add: [...desired].filter((tag) => !current.has(tag)),
    remove: held.filter((tag) => !desired.has(tag)),
  };
}

/**
 * Builds the `/sse` address, appending the initial tags as a query string
 * when any are configured.
 */
export function address(url: string, tags: ReadonlySet<string>): string {
  if (tags.size === 0) return `${url}/sse`;
  return `${url}/sse?tags=${encodeURIComponent([...tags].join(","))}`;
}

/**
 * Decides whether an arriving envelope is still deliverable to this
 * client: the envelope's audience tags (embedded at dispatch time) must
 * **all** be held by the client's current tag set. The server applied the
 * same rule at send time, but the client's tags may have changed while
 * the event was in flight &mdash; a downgrade racing an in-flight `vip`
 * event &mdash; so the receiving side re-validates against its live set
 * and quietly drops envelopes it no longer qualifies for.
 */
export function eligible(
  required: undefined | readonly string[],
  held: ReadonlySet<string>,
): boolean {
  if (G.isNullable(required) || required.length === 0) return true;
  return required.every((tag) => held.has(tag));
}

/**
 * Parses an SSE `data` field, absorbing malformed JSON from a misbehaving
 * server into a logged `null` instead of an uncaught listener error.
 */
export function parse<T>(data: string): null | T {
  try {
    return <T>JSON.parse(data);
  } catch {
    // eslint-disable-next-line no-console
    console.warn("march-hare: discarded a malformed SSE envelope.");
    return null;
  }
}
