import * as React from "react";
import { Brand, Filter, Model } from "../types/index.ts";
import { useRehydrator } from "../boundary/components/rehydrate/utils.ts";

/**
 * Serialises a channel object into a deterministic string key.
 * Keys are sorted alphabetically for deterministic output.
 * Returns an empty string for unchanneled operations.
 */
function serializeChannel(channel?: Filter): string {
  if (!channel) return "";
  return [...Object.keys(channel)]
    .toSorted()
    .map((key) => `${key}=${String(channel[key])}`)
    .join("&");
}
import type { Rehydrator } from "../boundary/components/rehydrate/types.ts";

/**
 * Branded wrapper for a model with rehydration metadata.
 * When passed to `useActions`, the model state is automatically saved to the
 * rehydrator on unmount and restored from it on remount.
 */
export type Rehydrated<M extends Model = Model> = {
  readonly [Brand.Rehydrate]: true;
  readonly model: M;
  readonly channel: Filter;
};

/**
 * Wraps an initial model with rehydration metadata.
 *
 * When a rehydrated model is passed to `useActions`, the component's state is
 * automatically snapshotted to the rehydrator on unmount and restored from it
 * on remount if a matching entry exists.
 *
 * The channel parameter acts as a key for the snapshot, allowing different
 * component instances to maintain independent rehydrated state.
 *
 * @template M - The model type.
 * @param model - The initial model (used as fallback when no snapshot exists).
 * @param channel - Channel key identifying this component's snapshot.
 * @returns A branded object containing the model and rehydration metadata.
 *
 * @example
 * ```ts
 * const actions = useActions<Model, typeof Actions>(
 *   Rehydrate(model, { UserId: props.userId }),
 * );
 * ```
 */
export function Rehydrate<M extends Model>(
  model: M,
  channel: Filter,
): Rehydrated<M> {
  return {
    [Brand.Rehydrate]: true,
    model,
    channel,
  };
}

/**
 * Type guard to detect whether a value is a `Rehydrated` wrapper.
 */
export function isRehydrated<M extends Model>(
  value: M | Rehydrated<M>,
): value is Rehydrated<M> {
  return (
    typeof value === "object" &&
    value !== null &&
    Brand.Rehydrate in value &&
    (<Rehydrated<M>>value)[Brand.Rehydrate] === true
  );
}

function lookupSnapshot<M extends Model>(
  rehydrator: Rehydrator,
  channel: Filter,
): M | null {
  const key = serializeChannel(channel);
  const snapshot = rehydrator.data.get(key);
  return snapshot ? <M>snapshot : null;
}

function saveSnapshot<M extends Model>(
  rehydrator: Rehydrator,
  channel: Filter,
  model: M,
): void {
  const key = serializeChannel(channel);
  rehydrator.data.set(key, model);
}

/**
 * Hook that resolves the initial model from a potential `Rehydrated` wrapper.
 *
 * On first call, checks the rehydrator for an existing snapshot matching the
 * channel key. If found, returns the snapshot; otherwise returns the initial
 * model. Also returns a `save` function for persisting the model on unmount.
 *
 * For non-rehydrated models, `save` is a no-op.
 *
 * @template M - The model type.
 * @param initialModelOrRehydrated - A plain model or a `Rehydrated` wrapper.
 * @returns The resolved model and a save function.
 */
export function useRehydration<M extends Model>(
  initialModelOrRehydrated: M | Rehydrated<M>,
): { model: M; save: (model: M) => void } {
  const rehydrator = useRehydrator();
  const resolved = React.useRef<{
    model: M;
    save: (model: M) => void;
  } | null>(null);

  if (!resolved.current) {
    if (isRehydrated(initialModelOrRehydrated)) {
      const { channel, model } = initialModelOrRehydrated;
      const snapshot = lookupSnapshot<M>(rehydrator, channel);
      // eslint-disable-next-line fp/no-mutation
      resolved.current = {
        model: snapshot ?? model,
        save: (m: M) => saveSnapshot(rehydrator, channel, m),
      };
    } else {
      // eslint-disable-next-line fp/no-mutation
      resolved.current = {
        model: initialModelOrRehydrated,
        save: () => {},
      };
    }
  }

  return resolved.current;
}
