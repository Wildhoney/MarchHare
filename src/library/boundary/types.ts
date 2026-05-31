import type * as React from "react";
import type { Store } from "./components/store/types.ts";

export type Props = {
  /**
   * Initial value of the per-Boundary {@link Store}. Prefer `App({ store })`
   * &mdash; it infers the Store shape and threads it through `app.useContext`,
   * `app.useStore`, and `app.Resource`. Pass `store` directly here only for
   * advanced cases where the loose {@link Store} record type is sufficient.
   */
  store?: Store;
  children: React.ReactNode;
};
