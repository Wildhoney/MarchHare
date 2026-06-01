import type * as React from "react";
import type { Env } from "./components/env/types.ts";

export type Props = {
  /**
   * Initial value of the per-Boundary {@link Env}. Prefer `App({ env })`
   * &mdash; it infers the Env shape and threads it through `app.useContext`,
   * `app.useEnv`, and `app.Resource`. Pass `env` directly here only for
   * advanced cases where the loose {@link Env} record type is sufficient.
   */
  env?: Env;
  children: React.ReactNode;
};
