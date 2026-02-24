import * as React from "react";
import type { ActionId } from "../tasks/types.ts";
import type { RegulatorPolicy } from "./types.ts";

/**
 * Default policy: all actions are allowed.
 */
const defaultPolicy: RegulatorPolicy = {
  mode: "allow-all",
  actions: new Set(),
};

/**
 * React context holding the shared, mutable regulator policy.
 */
export const Context = React.createContext<RegulatorPolicy>(defaultPolicy);

/**
 * Hook to access the regulator policy from the nearest `<Regulators>` provider.
 *
 * @returns The mutable `RegulatorPolicy` object from context.
 */
export function useRegulators(): RegulatorPolicy {
  return React.useContext(Context);
}

/**
 * Determines whether a given action is allowed under the current policy.
 *
 * @param action - The action identifier (symbol) to check.
 * @param policy - The current regulator policy.
 * @returns `true` if the action may proceed, `false` if it should be blocked.
 */
export function isAllowed(action: ActionId, policy: RegulatorPolicy): boolean {
  switch (policy.mode) {
    case "allow-all":
      return true;
    case "disallow-all":
      return false;
    case "disallow-matching":
      return !policy.actions.has(action);
    case "allow-matching":
      return policy.actions.has(action);
  }
}
