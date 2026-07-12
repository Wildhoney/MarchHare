import { getName } from "../action/index.ts";
import { isOmnicastAction } from "../omnicast/index.ts";
import type { Actions, OmnicastPayload } from "../types/index.ts";

/**
 * Finds the omnicast action on the wire class whose name matches an
 * incoming envelope. Non-omnicast members and unknown names resolve to
 * `null`, so the wire class acts as an allow-list for what a remote peer
 * may dispatch into the local Boundary.
 */
export function lookup(
  actions: Actions,
  name: string,
): null | OmnicastPayload<unknown> {
  for (const candidate of Object.values(actions)) {
    if (!isOmnicastAction(candidate)) continue;
    if (getName(candidate) === name) return candidate;
  }
  return null;
}

/**
 * Splits the desired tag set against the tags the server currently holds
 * for the connection, yielding the mutations required to align the server.
 * Used after every `connected` event so tag mutations survive the automatic
 * `EventSource` reconnect, which reverts the server to the query-string
 * tags.
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
