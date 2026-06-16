import type { Actions, HandlerContext, Model, Props } from "../types/index.ts";
import type { Env } from "../boundary/components/env/types.ts";
import type { BooleanPaths, Get, Paths } from "./types.ts";
import { makeAlways, makeInvert, makeUpdate } from "./utils.ts";

/**
 * Handler factories that wire an action directly to a model field. Prefer
 * `context.with` from `useContext<Model>()` for first-class autocompletion
 * over dotted paths; this top-level form is kept for callers that don't have
 * a typed `context` in scope.
 *
 * - {@link With.Update} assigns the dispatched payload to a model path.
 * - {@link With.Invert} flips a boolean leaf at a model path.
 * - {@link With.Always} assigns a fixed value to a model path, ignoring any
 *   dispatched payload.
 *
 * Keys may be lodash-style dotted paths (`"a.b.c"`) and support array
 * indices (`"items.0.name"`). The model type is inferred at handler-bind
 * time; an invalid path or mismatched payload fails to compile when the
 * handler is registered with `useAction`.
 *
 * @example
 * ```ts
 * import { With } from "march-hare";
 *
 * type Model = {
 *   name: string;
 *   sidebar: boolean;
 *   nested: { open: boolean };
 *   items: { id: number }[];
 * };
 *
 * actions.useAction(Actions.SetName, With.Update("name"));
 * actions.useAction(Actions.SetFirstId, With.Update("items.0.id"));
 * actions.useAction(Actions.ToggleSidebar, With.Invert("sidebar"));
 * actions.useAction(Actions.ToggleNested, With.Invert("nested.open"));
 * actions.useAction(Actions.Open, With.Always("nested.open", true));
 * ```
 */
export const With = {
  /**
   * Returns a handler that assigns the action payload to the model leaf at
   * the given lodash-style path. The payload type must match `Get<M, K>`,
   * and the path must exist on the model.
   *
   * @template K The dotted-path string indexing into the model.
   * @param key The lodash-style path to the model leaf being assigned.
   */
  Update<K extends string>(
    key: K,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    P extends K extends Paths<M> ? Get<M, K> : never,
    E extends Env = Env,
  >(
    context: HandlerContext<M, A, D, E>,
    payload: P,
  ) => void {
    return <(context: unknown, payload: unknown) => void>makeUpdate(key);
  },
  /**
   * Returns a handler that inverts a boolean leaf at the given lodash-style
   * path. The leaf must be a `boolean` on the model.
   *
   * @template K The dotted-path string indexing into a boolean leaf.
   * @param key The lodash-style path to the boolean leaf being toggled.
   */
  Invert<K extends string>(
    key: K,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    E extends Env = Env,
  >(
    context: K extends BooleanPaths<M> ? HandlerContext<M, A, D, E> : never,
  ) => void {
    return <(context: unknown) => void>makeInvert(key);
  },
  /**
   * Returns a handler that assigns a fixed `value` to the model leaf at the
   * given lodash-style path. The dispatched payload (if any) is ignored.
   *
   * @template K The dotted-path string indexing into the model.
   * @template V The constant value type; must be assignable to the leaf at `K`.
   * @param key The lodash-style path to the model leaf being assigned.
   * @param value The constant value pinned to the leaf.
   */
  Always<K extends string, V>(
    key: K,
    value: V,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    E extends Env = Env,
  >(
    context: K extends Paths<M>
      ? V extends Get<M, K>
        ? HandlerContext<M, A, D, E>
        : never
      : never,
  ) => void {
    return <(context: unknown) => void>makeAlways(key, value);
  },
};
