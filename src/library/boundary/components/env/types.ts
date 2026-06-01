import type { ReactNode } from "react";
import type { Env } from "./index.tsx";

export type { Env } from "./index.tsx";

/**
 * Props for the Env provider component. Accepts the initial Env
 * value that satisfies the augmented {@link Env} interface.
 */
export type Props = {
  initial: Env;
  children: ReactNode;
};
