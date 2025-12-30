import { Regulator, Context } from "./utils.ts";
import { Props } from "./types.ts";
import * as React from "react";

export { Regulator, useRegulators } from "./utils.ts";

/**
 * Creates a new regulator context for action control. Only needed if you
 * want to isolate a regulator context, useful for libraries that want to provide
 * their own regulator context without interfering with the app's regulator context.
 *
 * Operations like `abort.all()` and `policy.disallow.matching()` only affect
 * components within the same Regulators context.
 *
 * @param props.children - The children to render within the regulator context.
 * @returns The children wrapped in a regulator context provider.
 */
export function Regulators({ children }: Props): React.ReactNode {
  const regulators = React.useMemo<Set<Regulator>>(() => new Set(), []);

  return <Context.Provider value={regulators}>{children}</Context.Provider>;
}
