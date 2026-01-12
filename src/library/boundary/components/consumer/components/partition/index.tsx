import * as React from "react";
import { State, Inspect } from "immertation";
import { G } from "@mobily/ts-belt";
import { useBroadcast } from "../../../broadcast/index.tsx";
import { useConsumer } from "../../utils.ts";
import { Entry, Model } from "../../types.ts";
import { Props } from "./types.ts";

/**
 * Renders output for the `consume()` method by subscribing to distributed action events.
 *
 * This component manages a subscription to the broadcast emitter for distributed actions,
 * storing the latest dispatched value in the Consumer context. When a new value arrives,
 * all mounted Partition instances for that action re-render with the updated value.
 *
 * On mount, if a value was previously dispatched for this action, it renders immediately
 * with that cached value. If no value exists yet, it renders `null` until the first dispatch.
 *
 * Uses Immertation's State class internally to manage consumed values, providing real
 * annotation tracking through the `inspect` proxy. When a payload containing annotated
 * values is dispatched, the annotations are preserved and accessible via `inspect`.
 *
 * The renderer callback receives a `Box<T>` containing:
 * - `value`: The latest dispatched payload
 * - `inspect`: A proxy for checking annotation status (pending, is, draft, settled, etc.)
 *
 * @template T - The payload type for the action (must be an object type)
 * @param props.action - The distributed action symbol to subscribe to
 * @param props.renderer - Callback that receives a Box and returns React nodes
 * @returns The result of calling renderer with the Box, or null if no value exists
 * @internal
 */
export default function Partition<T extends object>({
  action,
  renderer,
}: Props<T>): React.ReactNode {
  const broadcast = useBroadcast();
  const consumer = useConsumer();
  const [, rerender] = React.useReducer((x: number) => x + 1, 0);

  const entry = React.useMemo(() => {
    const existing = consumer.get(action);
    if (existing) return existing as Entry<T>;

    const state = new State<Model<T>>();
    const entry: Entry<T> = { state, listeners: new Set() };
    consumer.set(action, entry);
    return entry;
  }, [action, consumer]);

  React.useLayoutEffect(() => {
    entry.listeners.add(rerender);

    function handlePayload(payload: T) {
      entry.state.hydrate({ value: payload });
      entry.listeners.forEach((listener) => listener());
    }

    broadcast.on(action, handlePayload);

    return () => {
      entry.listeners.delete(rerender);
      broadcast.off(action, handlePayload);
    };
  }, [action, broadcast, entry]);

  const value = entry.state.model?.value;
  if (G.isNullable(value)) return null;

  const inspect = entry.state.inspect as unknown as { value: Inspect<T> };

  return renderer({
    value,
    inspect: inspect.value,
  });
}
