import type { ScopeHandle } from "./types.ts";
import { createScope } from "./utils.tsx";

export type { ScopeHandle } from "./types.ts";
export { createScope } from "./utils.tsx";

/**
 * Standalone counterpart to `app.Scope<MulticastActions>()`, exported
 * as `shared.Scope` &mdash; opens a typed multicast scope without
 * going through an `App` handle. Takes the **Env shape `E` as a
 * mandatory first generic**, mirroring the other standalone exports
 * (`shared.useContext`, `shared.useEnv`, `shared.Resource`). The Env
 * carried by `scope.useContext()` is typed as `E`.
 *
 * Use this in reusable feature modules that need to open their own
 * multicast scope without binding to one App's `app.Scope` factory.
 * For single-app code, prefer `app.Scope<MulticastActions>()` &mdash;
 * the Env is captured from `app` automatically.
 *
 * @template E The Env shape (or union) the scope's `useContext` types
 *   `context.env` against.
 * @template A The multicast Actions class (or union of classes) the
 *   scope's dispatch surface is widened to include.
 *
 * @example
 * ```tsx
 * import { Action, Distribution, shared } from "march-hare";
 *
 * class MulticastActions {
 *   static Mood = Action<"happy" | "sad">(
 *     "Mood",
 *     Distribution.Multicast,
 *   );
 * }
 *
 * type MoodEnv = { tracker: string };
 *
 * export const scope = shared.Scope<MoodEnv, typeof MulticastActions>();
 * ```
 */
export function Scope<E extends object, A>(): ScopeHandle<E, A> {
  return createScope<E, A>();
}
