/**
 * Internal symbol description factories. Each function returns a namespaced
 * string suitable for `Symbol()` descriptions or `startsWith` checks.
 *
 * @internal
 */
export const describe = {
  /** Unicast action description. `describe.action("Fetch")` &rarr; `"march-hare.action/Fetch"` */
  action: (name = "") => `march-hare.action/${name}`,
  /** Broadcast action description. `describe.broadcast("User")` &rarr; `"march-hare.action/broadcast/User"` */
  broadcast: (name = "") => `march-hare.action/broadcast/${name}`,
  /** Multicast action description. `describe.multicast("Update")` &rarr; `"march-hare.action/multicast/Update"` */
  multicast: (name = "") => `march-hare.action/multicast/${name}`,
  /** Channeled action description. `describe.channel("user")` &rarr; `"march-hare.channel/user"` */
  channel: (name = "") => `march-hare.channel/${name}`,
  /** Cache entry description. `describe.cache("users")` &rarr; `"march-hare.cache/users"` */
  cache: (name = "") => `march-hare.cache/${name}`,
  /** Lifecycle action description. `describe.lifecycle("Mount")` &rarr; `"march-hare.action.lifecycle/Mount"` */
  lifecycle: (name = "") => `march-hare.action.lifecycle/${name}`,
  /** Mount replay sentinel description. Used to create the {@link replay} symbol. */
  replay: (name = "") => `march-hare/replay${name}`,
};

/**
 * Flat record used for shallow property comparison in {@link changes}.
 * @internal
 */
type Changes = Record<string, unknown>;

/**
 * Get high-level changed paths between two objects.
 * Returns an object containing only the properties that were added or updated.
 *
 * @param previous - The previous state object
 * @param next - The next state object
 * @returns Object with changed property keys and their new values
 */
export function changes(previous: Changes, next: Changes): Changes {
  return <Changes>(
    Object.keys(next).reduce(
      (result, key) =>
        previous[key] !== next[key] ? { ...result, [key]: next[key] } : result,
      {},
    )
  );
}
