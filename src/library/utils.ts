/**
 * Internal symbol description factories. Each function returns a namespaced
 * string suitable for `Symbol()` descriptions or `startsWith` checks.
 *
 * @internal
 */
export const describe = {
  /** Unicast action description. `describe.action("Fetch")` &rarr; `"chizu.action/Fetch"` */
  action: (name = "") => `chizu.action/${name}`,
  /** Broadcast action description. `describe.broadcast("User")` &rarr; `"chizu.action/broadcast/User"` */
  broadcast: (name = "") => `chizu.action/broadcast/${name}`,
  /** Multicast action description. `describe.multicast("Update")` &rarr; `"chizu.action/multicast/Update"` */
  multicast: (name = "") => `chizu.action/multicast/${name}`,
  /** Channeled action description. `describe.channel("user")` &rarr; `"chizu.channel/user"` */
  channel: (name = "") => `chizu.channel/${name}`,
  /** Cache entry description. `describe.cache("users")` &rarr; `"chizu.cache/users"` */
  cache: (name = "") => `chizu.cache/${name}`,
  /** Lifecycle action description. `describe.lifecycle("Mount")` &rarr; `"chizu.action.lifecycle/Mount"` */
  lifecycle: (name = "") => `chizu.action.lifecycle/${name}`,
  /** Mount replay sentinel description. Used to create the {@link replay} symbol. */
  replay: (name = "") => `chizu/replay${name}`,
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
