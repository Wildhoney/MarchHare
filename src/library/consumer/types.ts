import type { Box } from "immertation";
import type { Action } from "../regulator/types.ts";
import * as React from "react";

/**
 * Callback function for the consume() method.
 * Receives a Box wrapping the action's payload.
 *
 * @template T - The payload type
 */
export type ConsumerRenderer<T> = (box: Box<T>) => React.ReactNode;

/**
 * Entry storing the latest value and listeners for an action.
 * @template T - The payload type
 */
export type Entry<T = unknown> = {
  value: T | undefined;
  listeners: Set<() => void>;
};

/**
 * The consumer context is a Map storing entries keyed by action.
 */
export type ConsumerContext = Map<Action, Entry>;

/**
 * Props for the Consumer provider component.
 */
export type Props = {
  children: React.ReactNode;
};
