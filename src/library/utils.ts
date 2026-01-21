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
