import * as React from "react";
import type { Stored } from "./types.ts";

/**
 * Sentinel symbol marking "no value present yet". Shared by the Resource
 * cache and by storage handles so callers can distinguish "nothing has been
 * recorded" from "a legitimately stored null".
 */
export const unset: unique symbol = Symbol("march-hare.unset");

/**
 * Returns a function to force a component re-render. Useful when state is
 * managed externally (e.g., refs) but the UI needs updating.
 *
 * @returns A zero-arg callback that schedules a re-render of the host
 *          component when invoked.
 */
export function useRerender(): () => void {
  const [, rerender] = React.useReducer((x: number) => x + 1, 0);
  return rerender;
}

/**
 * Constructs a {@link Stored} in the empty state. Internal helper shared
 * by the storage layer and the Resource snapshot accessor.
 *
 * @template T The payload type the resulting Stored would carry if populated.
 * @returns A Stored with `data` set to {@link unset} and `at` set to `null`.
 *          Its `.else(fallback)` returns the fallback unchanged.
 * @internal
 */
export function empty<T>(): Stored<T> {
  return {
    data: unset,
    at: null,
    else: <U>(fallback: U): T | U => fallback,
  };
}

/**
 * Constructs a {@link Stored} wrapping a present payload and timestamp.
 *
 * @template T The payload type carried by the Stored.
 * @param data The payload value to wrap.
 * @param at The instant the payload was recorded — flows through to the
 *           Resource cache as the entry's `at` timestamp.
 * @returns A Stored whose `.else(fallback)` returns `data` unchanged.
 * @internal
 */
export function present<T>(data: T, at: Temporal.Instant): Stored<T> {
  return {
    data,
    at,
    else: <U>(_fallback: U): T | U => data,
  };
}
