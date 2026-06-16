import type { ReactNode } from "react";

/**
 * Loose runtime shape for the per-`<Boundary>` Env. Each {@link App}
 * narrows this to its own typed env via `App<E>({ env })`; the
 * loose type exists so the framework's internal plumbing
 * (`<Boundary>`, `useEnv`, handler `context.env`, Resource
 * fetcher `context.env`) does not need to be parametric over E.
 *
 * Consumers should declare their Env shape inline via `App({ env })`
 * &mdash; the inferred `E` is what flows through `app.useContext`,
 * `app.useEnv`, and `app.Resource`. Module augmentation of `Env`
 * is no longer required.
 */
export type Env = Record<string, unknown>;

/**
 * `E` generic for `shared.X<E, ...>` factories whose callers don't read
 * anything off the Env. Equivalent to `Record<never, never>` &mdash; the
 * named alias keeps consumer sites legible (`shared.Resource<Envless, T>`
 * over `shared.Resource<Record<never, never>, T>`) and signals intent.
 *
 * Reach for `Envless` only when the component or resource is genuinely
 * Env-agnostic. Anything that reads `context.env.x` should declare the
 * required shape (or a union of host Envs) as `E` instead.
 */
export type Envless = Record<never, never>;

/**
 * Props for the Env provider component. Accepts the initial Env
 * value that satisfies the augmented {@link Env} interface.
 */
export type Props = {
  initial: Env;
  children: ReactNode;
};
