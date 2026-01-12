import type { Box } from "immertation";
import { State } from "immertation";
import type { ActionId } from "../tasks/types.ts";
import * as React from "react";

/**
 * Callback function for the consume() method.
 * Receives a Box wrapping the action's payload.
 *
 * @template T - The payload type
 */
export type ConsumerRenderer<T> = (box: Box<T>) => React.ReactNode;

/**
 * Model for consumed values.
 * Allows Immertation's State to manage the value with real inspect capabilities.
 * @template T - The payload type
 */
export type Model<T> = { value: T };

/**
 * Entry storing the latest value and listeners for an action.
 * Uses Immertation's State to provide real inspect functionality for consumed values.
 * @template T - The payload type
 */
export type Entry<T = unknown> = {
  state: State<Model<T>>;
  listeners: Set<() => void>;
};

/**
 * The consumer context is a Map storing entries keyed by action.
 */
export type ConsumerContext = Map<ActionId, Entry>;

/**
 * Props for the Consumer provider component.
 */
export type Props = {
  children: React.ReactNode;
};
