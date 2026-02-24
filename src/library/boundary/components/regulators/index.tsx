import * as React from "react";
import { Context } from "./utils.ts";
import type { Props, RegulatorPolicy } from "./types.ts";

export { useRegulators, isAllowed } from "./utils.ts";
export type { Regulator, RegulatorPolicy } from "./types.ts";

/**
 * Provides a shared regulator policy to all descendant components.
 *
 * Wrap this around your component tree (or use `<Boundary>` which includes it)
 * to enable action regulation via `context.regulator`.
 *
 * @param props.children - The children to render within the regulator context.
 * @returns The children wrapped in a regulator context provider.
 */
export function Regulators({ children }: Props): React.ReactNode {
  const policy = React.useMemo<RegulatorPolicy>(
    () => ({ mode: "allow-all", actions: new Set() }),
    [],
  );

  return <Context.Provider value={policy}>{children}</Context.Provider>;
}
