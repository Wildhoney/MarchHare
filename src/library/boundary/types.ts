import type * as React from "react";
import type { Store } from "./components/store/types.ts";

export type Props = {
  /**
   * Initial value of the per-Boundary {@link Store}. The shape is
   * derived from module augmentation &mdash; declare the keys your
   * application needs once via:
   *
   * ```ts
   * declare module "march-hare" {
   *   interface Store {
   *     session: Session | null;
   *     locale: string;
   *   }
   * }
   * ```
   *
   * Optional only when the augmented Store has no required keys.
   */
  store?: Store;
  children: React.ReactNode;
};
