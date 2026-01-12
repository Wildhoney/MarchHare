import * as React from "react";
import { Box, Inspect } from "immertation";
import { G } from "@mobily/ts-belt";
import { useBroadcast } from "../../../broadcast/index.tsx";
import { useConsumer } from "../../utils.ts";
import { Entry } from "../../types.ts";
import { Props } from "./types.ts";

/**
 * Renders output for the `consume()` method by subscribing to distributed action events.
 *
 * This component manages a subscription to the broadcast emitter for distributed actions,
 * storing the latest dispatched value in the Consumer context. When a new value arrives,
 * all mounted ConsumeRenderer instances for that action re-render with the updated value.
 *
 * On mount, if a value was previously dispatched for this action, it renders immediately
 * with that cached value. If no value exists yet, it renders `null` until the first dispatch.
 *
 * The renderer callback receives a `Box<T>` containing:
 * - `value`: The latest dispatched payload
 * - `inspect`: A proxy for checking annotation status (empty in this context)
 *
 * @template T - The payload type for the action
 * @param props.action - The distributed action symbol to subscribe to
 * @param props.renderer - Callback that receives a Box and returns React nodes
 * @returns The result of calling renderer with the Box, or null if no value exists
 * @internal
 */
export default function ConsumeRenderer<T>({
  action,
  renderer,
}: Props<T>): React.ReactNode {
  const broadcast = useBroadcast();
  const consumer = useConsumer();
  const [, rerender] = React.useReducer((x: number) => x + 1, 0);

  const entry = React.useMemo(() => {
    const existing = consumer.get(action);
    if (existing) return existing as Entry<T>;

    const entry: Entry<T> = { value: undefined, listeners: new Set() };
    consumer.set(action, entry);
    return entry;
  }, [action, consumer]);

  React.useLayoutEffect(() => {
    entry.listeners.add(rerender);

    function handlePayload(payload: T) {
      entry.value = payload;
      entry.listeners.forEach((listener) => listener());
    }

    broadcast.on(action, handlePayload);

    return () => {
      entry.listeners.delete(rerender);
      broadcast.off(action, handlePayload);
    };
  }, [action, broadcast, entry]);

  if (G.isNullable(entry.value)) return null;

  const box: Box<T> = {
    value: entry.value,
    inspect: {} as Inspect<T>,
  };

  return renderer(box);
}
