import * as React from "react";
import type { Stored } from "./types.ts";

/**
 * Sentinel symbol marking "no value present yet". Shared by the Resource
 * cache and by storage handles so callers can distinguish "nothing has been
 * recorded" from "a legitimately stored null".
 */
export const unset: unique symbol = Symbol("march-hare.unset");

/**
 * Internal configuration shared across the Resource and Cache layers.
 *
 * - `unset` &mdash; re-export of the shared sentinel so consumers can pull
 *   both fields from a single object.
 * - `storageNamespace` &mdash; global prefix the Cache layer prepends to
 *   every key it persists. Lets `Cache.clear()` and the partial-match
 *   evictors scope themselves to the library's own entries on shared
 *   backends (`localStorage`, `chrome.storage.local`, MMKV) without
 *   nuking third-party state on the same origin.
 *
 * @internal
 */
export const config = <const>{
  unset,
  storageNamespace: "mh:",
};

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
 * @internal
 */
export function empty<T>(): Stored<T> {
  return { data: unset, at: null };
}

/**
 * Constructs a {@link Stored} wrapping a present payload and timestamp.
 *
 * @template T The payload type carried by the Stored.
 * @param data The payload value to wrap.
 * @param at The instant the payload was recorded — flows through to the
 *           Resource cache as the entry's `at` timestamp.
 * @internal
 */
export function present<T>(data: T, at: Temporal.Instant): Stored<T> {
  return { data, at };
}
