import type * as React from "react";
import type { ActionId } from "../tasks/types.ts";

/**
 * The four policy modes that the regulator supports.
 *
 * - `allow-all` (default) &ndash; every action is permitted (`allow()` with no args).
 * - `disallow-all` &ndash; every action is blocked (`disallow()` with no args).
 * - `disallow-matching` &ndash; only the listed actions are blocked (`disallow(A, B)`).
 * - `allow-matching` &ndash; only the listed actions are permitted (`allow(A, B)`).
 *
 * For "except" patterns, compose two calls:
 * - Block all except X: `disallow()` then `allow(X)`.
 * - Allow all except X: `allow()` then `disallow(X)`.
 */
export type RegulatorMode =
  | "allow-all"
  | "disallow-all"
  | "disallow-matching"
  | "allow-matching";

/**
 * Mutable policy object shared across all components in a `<Boundary>`.
 * Mutated in-place by the `context.regulator` API &ndash; last write wins.
 */
export type RegulatorPolicy = {
  mode: RegulatorMode;
  actions: Set<ActionId>;
};

/**
 * The `context.regulator` API shape exposed to action handlers.
 *
 * - `disallow()` &ndash; block all actions.
 * - `disallow(A, B)` &ndash; block only the listed actions.
 * - `allow()` &ndash; allow all actions (reset to default).
 * - `allow(A, B)` &ndash; allow only the listed actions.
 *
 * Each call replaces the previous policy entirely (last-write-wins).
 */
export type Regulator = {
  /**
   * Block actions. Called with no arguments, blocks everything.
   * Called with specific actions, blocks only those actions.
   */
  disallow(...actions: ReadonlyArray<{ readonly [x: symbol]: unknown }>): void;
  /**
   * Allow actions. Called with no arguments, allows everything (reset).
   * Called with specific actions, allows only those actions.
   */
  allow(...actions: ReadonlyArray<{ readonly [x: symbol]: unknown }>): void;
};

export type Props = {
  children: React.ReactNode;
};
