import * as React from "react";
import { Brand, Filter, Model } from "../types/index.ts";
import { useRehydrator } from "../boundary/components/rehydrate/utils.ts";

/**
 * Serialises a channel object into a deterministic string key.
 * Keys are sorted alphabetically for deterministic output.
 * Returns an empty string for unchanneled operations.
 */
export function serializeChannel(channel?: Filter): string {
  if (!channel) return "";
  return [...Object.keys(channel)]
    .toSorted()
    .map((key) => `${key}=${String(channel[key])}`)
    .join("&");
}
import type { Rehydrator } from "../boundary/components/rehydrate/types.ts";

/**
 * Phantom brand symbol for model type tracking on store identifiers.
 * Uses a function type `(m: M) => M` to enforce invariance, preventing
 * a store entry declared for one model from being used with a different model.
 * @internal
 */
declare const StoreModelBrand: unique symbol;

/**
 * A `Filter` branded with a phantom model type `M`.
 *
 * Returned by `Id<M>()` and `Id<M, C>()`, this type carries the model at
 * the type level so that `Rehydrate(model, storeId)` can verify at compile
 * time that the model and the store entry agree on the model shape.
 *
 * The phantom brand uses a function type `(m: M) => M` to enforce invariance —
 * `StoreId<A>` is not assignable to `StoreId<B>` unless `A` and `B` are
 * identical, preventing accidental cross-component snapshot usage.
 *
 * @template M - The model type this store entry is scoped to.
 */
export type StoreId<M extends Model = Model> = Filter & {
  readonly [StoreModelBrand]?: (m: M) => M;
};

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
 * Creates a typed store entry for rehydration snapshots.
 *
 * The first type parameter `M` binds the store entry to a specific model type,
 * ensuring that `Rehydrate(model, storeId)` produces a compile-time error if
 * the model and store entry disagree on the model shape.
 *
 * When called with only `M`, returns a nullary function that produces a unique
 * `StoreId<M>` — useful for components with a single instance (unchanneled).
 *
 * When called with `M` and `C`, returns a unary function that passes through
 * the channel object as `C & StoreId<M>` — useful for components with multiple
 * instances keyed by some identifier (channeled).
 *
 * @template M - The model type this store entry is scoped to.
 * @template C - The channel type, constrained to `Filter` (object of non-nullable primitives).
 * @returns A function that produces a `StoreId<M>` for use with `Rehydrate` and `invalidate`.
 *
 * @example
 * ```ts
 * import { Id, Rehydrate } from "chizu";
 *
 * type CounterModel = { count: number };
 *
 * class Store {
 *   // Unchanneled — one snapshot for all instances
 *   static Settings = Id<SettingsModel>();
 *
 *   // Channeled — independent snapshot per UserId
 *   static Counter = Id<CounterModel, { UserId: number }>();
 * }
 *
 * // Unchanneled usage
 * const actions = useActions<SettingsModel, typeof Actions>(
 *   Rehydrate(model, Store.Settings()),
 * );
 *
 * // Channeled usage
 * const actions = useActions<CounterModel, typeof Actions>(
 *   Rehydrate(model, Store.Counter({ UserId: props.userId })),
 * );
 *
 * // Compile error — model mismatch!
 * // Rehydrate(settingsModel, Store.Counter({ UserId: 1 }));
 *
 * // Invalidate a specific snapshot
 * context.actions.invalidate(Store.Counter({ UserId: 5 }));
 * context.actions.invalidate(Store.Settings());
 * ```
 */
export function Id<M extends Model>(): () => StoreId<M>;
export function Id<M extends Model, C extends Filter>(): (
  channel: C,
) => C & StoreId<M>;
export function Id(): (() => Filter) | ((channel: Filter) => Filter) {
  const id = Symbol();
  return (channel?: Filter): Filter => channel ?? { _: id };
}

/**
 * Wraps an initial model with rehydration metadata.
 *
 * When a rehydrated model is passed to `useActions`, the component's state is
 * automatically snapshotted to the rehydrator on unmount and restored from it
 * on remount if a matching entry exists.
 *
 * The channel must be a `StoreId<M>` produced by `Id<M>()` or `Id<M, C>()`.
 * TypeScript verifies that the model type `M` of the store entry matches the
 * model being passed, preventing accidental cross-component snapshot usage.
 *
 * @template M - The model type.
 * @param model - The initial model (used as fallback when no snapshot exists).
 * @param channel - A `StoreId<M>` identifying this component's snapshot.
 * @returns A branded object containing the model and rehydration metadata.
 *
 * @example
 * ```ts
 * const actions = useActions<Model, typeof Actions>(
 *   Rehydrate(model, Store.Counter({ UserId: props.userId })),
 * );
 * ```
 */
export function Rehydrate<M extends Model>(
  model: M,
  channel: StoreId<M>,
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
): {
  model: M;
  save: (model: M) => void;
  invalidate: (channel: Filter) => void;
} {
  const rehydrator = useRehydrator();
  const resolved = React.useRef<{
    model: M;
    save: (model: M) => void;
    invalidate: (channel: Filter) => void;
  } | null>(null);

  if (!resolved.current) {
    const invalidate = (channel: Filter) => {
      const key = serializeChannel(channel);
      rehydrator.data.delete(key);
    };

    if (isRehydrated(initialModelOrRehydrated)) {
      const { channel, model } = initialModelOrRehydrated;
      const snapshot = lookupSnapshot<M>(rehydrator, channel);
      // eslint-disable-next-line fp/no-mutation
      resolved.current = {
        model: snapshot ?? model,
        save: (m: M) => saveSnapshot(rehydrator, channel, m),
        invalidate,
      };
    } else {
      // eslint-disable-next-line fp/no-mutation
      resolved.current = {
        model: initialModelOrRehydrated,
        save: () => {},
        invalidate,
      };
    }
  }

  return resolved.current;
}
