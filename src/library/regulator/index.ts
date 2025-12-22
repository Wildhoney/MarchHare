import { Reason } from "../error/types.ts";
import { Action, Entries, Policies, Policy } from "./types.ts";

/**
 * Manages AbortControllers and action policies for controlling asynchronous operations.
 */
export default class Regulator {
  /**
   * Set of currently active action/controller entries.
   */
  private controllers: Set<Entries> = new Set();

  /**
   * Set of action policies (allow/disallow specific actions).
   */
  private policies = new Set<Policies>();

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
   * Abort controllers for all actions or a specific action.
   */
  abort = {
    /**
     * Abort all controllers for all actions and remove them from the set.
     */
    all: (): void => {
      [...this.controllers].forEach((entry) => {
        entry.controller.abort(Reason.Disallowed);
        this.controllers.delete(entry);
      });
    },
    /**
     * Abort all controllers for a specific action and remove them from the set.
     * @param action - The action identifier (symbol or string)
     */
    matching: (action: Action): void => {
      [...this.controllers].forEach((entry) => {
        if (entry.action === action) {
          entry.controller.abort(Reason.Disallowed);
          this.controllers.delete(entry);
        }
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
       * Allow multiple actions by updating their policies.
       * @param actions - One or more action identifiers (symbol or string)
       */
      all: (...actions: Action[]): void => {
        actions.forEach((action) => {
          this.policy.remove(Policy.Disallow, action);
          this.policies.add({ rule: Policy.Allow, action });
        });
      },
      /**
       * Allow a specific action by updating its policy.
       * @param action - The action identifier (symbol or string)
       */
      matching: (action: Action): void => {
        this.policy.remove(Policy.Disallow, action);
        this.policies.add({ rule: Policy.Allow, action });
      },
    },
    /**
     * Methods for disallowing actions.
     */
    disallow: {
      /**
       * Disallow multiple actions by updating their policies.
       * @param actions - One or more action identifiers (symbol or string)
       */
      all: (...actions: Action[]): void => {
        actions.forEach((action) => {
          this.policy.remove(Policy.Allow, action);
          this.policies.add({ rule: Policy.Disallow, action });
        });
      },
      /**
       * Disallow a specific action by updating its policy.
       * @param action - The action identifier (symbol or string)
       */
      matching: (action: Action): void => {
        this.policy.remove(Policy.Allow, action);
        this.policies.add({ rule: Policy.Disallow, action });
      },
    },
  };
}
