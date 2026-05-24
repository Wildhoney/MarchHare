import * as React from "react";
import type { Props } from "./types.ts";
import { Context } from "./utils.ts";

export { useStore } from "./utils.ts";

/**
 * App-wide store of cross-cutting, mutable state. The interface is
 * declared empty here and **augmented** by consumer code via module
 * augmentation:
 *
 * @example
 * ```ts
 * declare module "march-hare" {
 *   interface Store {
 *     session: Session | null;
 *     locale: string;
 *     featureFlags: Record<string, boolean>;
 *   }
 * }
 * ```
 *
 * Every key declared here flows into:
 *
 * - `useStore()` &mdash; the per-`<Boundary>` handle for reads and writes.
 * - `context.store` inside `useActions` handlers.
 * - The `store` field on every `Resource` fetcher's args object.
 *
 * The Store is **not** reactive. Mutating it does not re-render. Drive
 * view state through the model; use the Store for cross-handler
 * coordination, session tokens, locale, feature flags, etc.
 */
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/consistent-type-definitions */
export interface Store {}
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/consistent-type-definitions */

/**
 * Provides a per-Boundary {@link Store} value to every component inside
 * the boundary. Usually wired in via the `<Boundary store={initial}>`
 * prop rather than used directly.
 *
 * The Store is **not** reactive. Mutating it does not trigger a
 * re-render. Drive view state through the model; use the Store for
 * cross-handler coordination.
 */

export function Store({ initial, children }: Props): React.ReactNode {
  const ref = React.useRef<Store>(initial);
  return <Context.Provider value={ref}>{children}</Context.Provider>;
}
