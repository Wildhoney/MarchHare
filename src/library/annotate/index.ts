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
 * @param operation - The operation type (e.g., Op.Update).
 * @param value - The value to annotate.
 * @returns The annotated value (typed as T for assignment compatibility).
 *
 * @example
 * ```ts
 * import { annotate, Op } from "chizu";
 *
 * type Model = { user: User | null };
 *
 * const model: Model = {
 *   user: annotate(Op.Update, null),
 * };
 *
 * // actions.inspect.user.pending() === true from the first render
 * ```
 */
export function annotate<T>(operation: Operation, value: T): T {
  return state.annotate(operation, value);
}
