import { State, Operation } from "immertation";

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
