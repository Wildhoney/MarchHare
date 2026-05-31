/**
 * The signature `useContext` stores in a ref once
 * `context.useActions(...)` runs &mdash; the underlying dispatch target.
 * `context.actions.dispatch(action, payload?)` forwards through this
 * function so the handle returned by `useContext` is callable before
 * the matching `useActions` call has wired everything up.
 *
 * Erased to `unknown` because the public surface re-types `dispatch` per
 * call site via the action's generic constraints; the runtime contract
 * is just "(action, payload?) => Promise<void>".
 *
 * @internal
 */
export type DispatchTarget = (
  action: unknown,
  payload?: unknown,
) => Promise<void>;
