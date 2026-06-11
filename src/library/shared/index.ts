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
 * | `app.Resource.Cachable(...)`     | `shared.Resource.Cachable<E, T, P>(...)` |
 * | `app.Scope<A>()`                 | `shared.Scope<E, A>()`                   |
 *
 * @see {@link ./app/index.tsx App}
 */

export { useContext, useEnv } from "../app/index.tsx";
export { Scope } from "../scope/index.tsx";
export { Resource } from "../resource/index.ts";
