import type { BroadcastEmitter } from "../broadcast/utils.ts";

/**
 * Runtime entry for a single multicast scope opened by an
 * `<app.Scope().Boundary>`. The `id` uniquely identifies this scope
 * instance; the `emitter` carries every multicast event dispatched
 * inside the boundary, keyed internally by the action's symbol.
 *
 * Nested boundaries shadow outer ones via React context.
 *
 * @internal
 */
export type ScopeEntry = {
  readonly id: symbol;
  readonly emitter: BroadcastEmitter;
};

/**
 * The scope context. `null` when no `<app.Scope().Boundary>` exists in
 * the ancestor chain; otherwise the nearest entry &mdash; React context
 * shadowing makes nested boundaries override outer ones for the
 * subtree.
 *
 * @internal
 */
export type ScopeContext = ScopeEntry | null;
