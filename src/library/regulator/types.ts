import { Action } from "../types/index.ts";

/**
 * Represents an entry associating an action with its AbortController.
 * @property action - The action identifier (symbol or string)
 * @property controller - The AbortController instance for the action
 */
export type Entries = {
  action: Action;
  controller: AbortController;
};

/**
 * Represents a policy rule for a specific action.
 * @property rule - The policy rule (Allow or Disallow)
 * @property action - The action identifier (symbol or string)
 */
export type Policies = {
  rule: Policy;
  action: Action;
};

/**
 * Enum for action policy rules.
 * - Allow: The action is permitted.
 * - Disallow: The action is not permitted and will be aborted.
 */
export enum Policy {
  Allow,
  Disallow,
}
