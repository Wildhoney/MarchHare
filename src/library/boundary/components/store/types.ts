import type { ReactNode } from "react";
import type { Store } from "./index.tsx";

export type { Store } from "./index.tsx";

/**
 * Props for the Store provider component. Accepts the initial Store
 * value that satisfies the augmented {@link Store} interface.
 */
export type Props = {
  initial: Store;
  children: ReactNode;
};
