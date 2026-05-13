import { State, Operation } from "immertation";

/**
 * Module-level Immertation state instance used to annotate initial model values
 * with operation metadata (e.g., {@link Operation}) before hydration.
 *
 * This is intentionally a singleton — it exists solely to provide the
 * {@link annotate} helper with access to `State.annotate`, without requiring
 * consumers to instantiate their own `State` object.
 */
const state = new State();

/**
 * Wraps a value with an operation annotation for use in initial model definitions.
 * When passed as part of the initial model to `useActions`, the annotation is
 * registered during hydration so that `actions.inspect` reports the field as pending
 * from the very first render.
 *
 * @param value - The value to annotate.
 * @param operation - The operation type (defaults to {@link Operation.Update}).
 * @returns The annotated value (typed as T for assignment compatibility).
 *
 * @example
 * ```ts
 * import { annotate } from "march-hare";
 *
 * type Model = { user: User | null };
 *
 * const model: Model = {
 *   user: annotate(null),
 * };
 *
 * // actions.inspect.user.pending() === true from the first render
 * ```
 */
export function annotate<T>(
  value: T,
  operation: Operation = Operation.Update,
): T {
  return state.annotate(operation, value);
}
