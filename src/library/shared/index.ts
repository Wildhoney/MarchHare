/**
 * `shared` namespace &mdash; standalone counterparts to the `app.X`
 * factories returned by `App<E>()`. Each export takes the Env shape
 * `E` as a mandatory first generic so reusable components can run
 * under more than one App without binding to a single `app` import.
 *
 * Reach for `shared.X` only when a component must support more than
 * one App. Single-app code should keep using `app.X` &mdash; the Env
 * is captured from `app` automatically and the call site is one
 * generic shorter.
 *
 * | Bound to an App                  | Standalone (`shared.X`)                  |
 * | -------------------------------- | ---------------------------------------- |
 * | `app.useContext<M, A, D>()`      | `shared.useContext<E, M, A, D>()`        |
 * | `app.useEnv()`                   | `shared.useEnv<E>()`                     |
 * | `app.Resource<T, P>(...)`        | `shared.Resource<E, T, P>(...)`          |
 * | `app.Scope<A>()`                 | `shared.Scope<E, A>()`                   |
 *
 * `shared.Resource` declarations always read from and write to an
 * in-memory cache &mdash; persistence is an App-level concern wired up
 * via `App({ cache })`. Reach for `app.Resource` instead when a resource
 * needs to survive reloads.
 *
 * @see {@link ./app/index.tsx App}
 */

import { Resource as InternalResource } from "../resource/index.ts";
import type { AppFetcher } from "../app/types.ts";
import type { LocalResourceHandle, ResourceHandle } from "../resource/types.ts";
import { G } from "@mobily/ts-belt";

export { useContext, useEnv } from "../app/index.tsx";
export { Scope } from "../scope/index.tsx";

/**
 * Standalone counterpart to `app.Resource`, exported as
 * `shared.Resource`. Takes the **Env shape `E` as a mandatory first
 * generic** so the fetcher's `context.env` is typed even when the
 * resource isn't bound to a single App.
 *
 * Call with **no fetcher** (`shared.Resource<E, T, P>()`) to declare a
 * local Resource whose slots are written exclusively through
 * `context.actions.resource(...).set(value)` rather than by a fetch.
 *
 * Always uses an isolated in-memory cache &mdash; persistent caching
 * is an App-level concern wired through `App({ cache })`, so reach for
 * `app.Resource` when a resource needs to survive reloads.
 */
export function Resource<
  _E extends object,
  T,
  P extends object = Record<never, never>,
>(): LocalResourceHandle<T, P>;
export function Resource<
  E extends object,
  T,
  P extends object = Record<never, never>,
>(fetcher: AppFetcher<E, T, P>): ResourceHandle<T, P>;
export function Resource<
  E extends object,
  T,
  P extends object = Record<never, never>,
>(
  fetcher?: AppFetcher<E, T, P>,
): ResourceHandle<T, P> | LocalResourceHandle<T, P> {
  if (G.isUndefined(fetcher)) {
    return InternalResource<E, T, P>(undefined);
  }
  return InternalResource<E, T, P>(fetcher);
}
