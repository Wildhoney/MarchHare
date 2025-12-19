import { Action } from "../types/index.ts";
import { Entries, Policies, Policy } from "./types.ts";

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

    [...this.policies].forEach((policy) => {
      if (policy.action === action && policy.rule === Policy.Disallow) {
        controller.abort();
        //  this.controllers.delete(controller);
      }
    });

    this.controllers.add({ action, controller });

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
        entry.controller.abort();
        this.controllers.delete(entry);
      });
    },
    /**
     * Abort all controllers for a specific action and remove them from the set.
     * @param action - The action identifier (symbol or string)
     */
    for: (action: Action): void => {
      [...this.controllers].forEach((entry) => {
        if (entry.action === action) {
          entry.controller.abort();
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
     * Allow one or more actions by updating their policy.
     * @param actions - One or more action identifiers (symbol or string)
     */
    allow: (...actions: Action[]): void => {
      actions.forEach((action) => {
        this.policies.delete({ rule: Policy.Disallow, action });
        this.policies.add({ rule: Policy.Allow, action });
      });
    },
    /**
     * Disallow one or more actions by updating their policy.
     * @param actions - One or more action identifiers (symbol or string)
     */
    disallow: (...actions: Action[]): void => {
      actions.forEach((action) => {
        this.policies.delete({ rule: Policy.Allow, action });
        this.policies.add({ rule: Policy.Disallow, action });
      });
    },
  };
}
