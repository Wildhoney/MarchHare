import { Reason } from "../error/types.ts";
import { Action, Entries, Policies, Policy } from "./types.ts";
import * as React from "react";

/**
 * Manages AbortControllers and action policies for controlling asynchronous operations.
 */
export class Regulator {
  /**
   * Set of currently active action/controller entries.
   * @internal
   */
  controllers: Set<Entries> = new Set();

  /**
   * Set of action policies (allow/disallow specific actions).
   * @internal
   */
  policies = new Set<Policies>();

  /**
   * Reference to the regulators set this regulator belongs to.
   */
  private regulators: Set<Regulator>;

  /**
   * Creates a new Regulator instance.
   * @param regulators - The shared Set of regulators from the React context.
   */
  constructor(regulators: Set<Regulator>) {
    this.regulators = regulators;
  }

  /**
   * Add an AbortController for a specific action.
   * @param action - The action identifier (symbol or string)
   * @param controller - The AbortController instance to associate
   */
  public add(action: Action, controller: AbortController): void {
    this.controllers.add({ action, controller });
  }

  /**
   * Create and register an AbortController for an action, respecting policies.
   * If the action is disallowed, the controller is immediately aborted.
   * @param action - The action identifier (symbol or string)
   * @returns The created AbortController
   */
  public controller(action: Action): AbortController {
    const controller = new AbortController();
    const disallowed = [...this.policies].some(
      (policy) => policy.action === action && policy.rule === Policy.Disallow,
    );

    if (disallowed) controller.abort(Reason.Disallowed);
    else this.controllers.add({ action, controller });

    return controller;
  }

  /**
   * Abort controllers.
   */
  abort = {
    /**
     * Abort all controllers across all components in the context.
     */
    all: (): void => {
      this.regulators.forEach((regulator) => {
        [...regulator.controllers].forEach((entry) => {
          entry.controller.abort(Reason.Disallowed);
          regulator.controllers.delete(entry);
        });
      });
    },
    /**
     * Abort controllers for specific actions across all components in the context.
     * @param actions - One or more action identifiers (symbol or string)
     */
    matching: (...actions: Action[]): void => {
      this.regulators.forEach((regulator) => {
        [...regulator.controllers].forEach((entry) => {
          if (actions.includes(entry.action)) {
            entry.controller.abort(Reason.Disallowed);
            regulator.controllers.delete(entry);
          }
        });
      });
    },
  };

  /**
   * Manage allow/disallow policies for actions.
   */
  policy = {
    /**
     * Remove a policy entry matching the given rule and action.
     * @param rule - The policy rule to match
     * @param action - The action identifier to match
     */
    remove: (rule: Policy, action: Action): void => {
      for (const policy of this.policies) {
        if (policy.rule === rule && policy.action === action) {
          this.policies.delete(policy);
          break;
        }
      }
    },
    /**
     * Methods for allowing actions.
     */
    allow: {
      /**
       * Clear all Disallow policies across all components in the context.
       */
      all: (): void => {
        this.regulators.forEach((regulator) => {
          [...regulator.policies]
            .filter((p) => p.rule === Policy.Disallow)
            .forEach((p) => regulator.policies.delete(p));
        });
      },
      /**
       * Allow specific actions across all components in the context.
       * @param actions - One or more action identifiers (symbol or string)
       */
      matching: (...actions: Action[]): void => {
        this.regulators.forEach((regulator) => {
          actions.forEach((action) => {
            regulator.policy.remove(Policy.Disallow, action);
            regulator.policies.add({ rule: Policy.Allow, action });
          });
        });
      },
    },
    /**
     * Methods for disallowing actions.
     */
    disallow: {
      /**
       * Clear all Allow policies across all components in the context.
       */
      all: (): void => {
        this.regulators.forEach((regulator) => {
          [...regulator.policies]
            .filter((p) => p.rule === Policy.Allow)
            .forEach((p) => regulator.policies.delete(p));
        });
      },
      /**
       * Disallow specific actions across all components in the context.
       * @param actions - One or more action identifiers (symbol or string)
       */
      matching: (...actions: Action[]): void => {
        this.regulators.forEach((regulator) => {
          actions.forEach((action) => {
            regulator.policy.remove(Policy.Allow, action);
            regulator.policies.add({ rule: Policy.Disallow, action });
          });
        });
      },
    },
  };
}

/**
 * React context for the regulators set.
 * Allows cross-component action control.
 */
export const Context = React.createContext<Set<Regulator>>(new Set());

/**
 * Hook to access the regulators set from context.
 *
 * @returns The Set of Regulator instances in the current context.
 */
export function useRegulators(): Set<Regulator> {
  return React.useContext(Context);
}
