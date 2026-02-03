import * as React from "react";
import { State, Inspect } from "immertation";
import { G } from "@mobily/ts-belt";
import { useScope, getScope } from "./utils.ts";
import type { ScopeEntry } from "./types.ts";
import { useRerender } from "../../../utils/utils.ts";
import type { Entry, Model, ConsumerRenderer } from "../consumer/types.ts";
import type { ActionId } from "../tasks/types.ts";

/**
 * Props for the MulticastPartition component.
 */
export type Props<T> = {
  /** The multicast action symbol to subscribe to */
  action: ActionId;
  /** The scope name to subscribe to */
  scopeName: string;
  /** Callback that receives a Box and returns React nodes */
  renderer: ConsumerRenderer<T>;
};

/**
 * Gets or creates an entry in the scope's consumer store.
 */
function getOrCreateEntry<T>(
  scopeEntry: ScopeEntry,
  action: ActionId,
): Entry<T> {
  const existing = scopeEntry.store.get(action);
  if (existing) return existing as Entry<T>;

  const state = new State<Model<T>>();
  const entry: Entry<T> = { state, listeners: new Set() };
  scopeEntry.store.set(action, entry);
  return entry;
}

/**
 * Renders output for multicast `consume()` by subscribing to scope action events.
 *
 * Similar to the broadcast Partition component, but subscribes to a named scope's
 * EventEmitter instead of the global broadcast emitter.
 *
 * On mount, if a value was previously dispatched for this action within the scope,
 * it renders immediately with that cached value. If no value exists yet, it renders
 * `null` until the first dispatch.
 *
 * @template T - The payload type for the action
 * @param props.action - The multicast action symbol to subscribe to
 * @param props.scopeName - The scope name to subscribe to
 * @param props.renderer - Callback that receives a Box and returns React nodes
 * @returns The result of calling renderer with the Box, or null if no value/scope exists
 * @internal
 */
export function MulticastPartition<T extends object>({
  action,
  scopeName,
  renderer,
}: Props<T>): React.ReactNode {
  const scopeContext = useScope();
  const rerender = useRerender();

  // Find the matching scope
  const scopeEntry = React.useMemo(
    () => getScope(scopeContext, scopeName),
    [scopeContext, scopeName],
  );

  // Get or create entry in the scope's store
  const entry = React.useMemo(() => {
    if (!scopeEntry) return null;
    return getOrCreateEntry<T>(scopeEntry, action);
  }, [action, scopeEntry]);

  React.useLayoutEffect(() => {
    if (!scopeEntry || !entry) return;

    entry.listeners.add(rerender);

    function handlePayload(payload: T) {
      if (!entry) return;
      entry.state.hydrate({ value: payload });
      entry.listeners.forEach((listener) => listener());
    }

    scopeEntry.emitter.on(action, handlePayload);

    return () => {
      entry.listeners.delete(rerender);
      scopeEntry.emitter.off(action, handlePayload);
    };
  }, [action, scopeEntry, entry, rerender]);

  // No scope found or no entry
  if (!entry) return null;

  const value = entry.state.model?.value;
  if (G.isNullable(value)) return null;

  const inspect = entry.state.inspect as unknown as { value: Inspect<T> };

  return renderer({
    value,
    inspect: inspect.value,
  });
}
