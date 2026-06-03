import type { Actions, HandlerContext, Model, Props } from "../types/index.ts";
import type { Env } from "../boundary/components/env/index.tsx";

/**
 * Handler factories that wire an action directly to a model field.
 *
 * - {@link With.Update} assigns the dispatched payload to `model[key]`.
 * - {@link With.Invert} flips a boolean field on `model[key]`.
 *
 * Both are typed so the call site fails to compile when `key` is missing or
 * has an incompatible type.
 *
 * @example
 * ```ts
 * import { With } from "march-hare";
 *
 * type Model = { name: string; sidebar: boolean };
 *
 * class Actions {
 *   static SetName = Action<string>("SetName");
 *   static ToggleSidebar = Action("ToggleSidebar");
 * }
 *
 * actions.useAction(Actions.SetName, With.Update("name"));
 * actions.useAction(Actions.ToggleSidebar, With.Invert("sidebar"));
 * ```
 */
export const With = {
  /**
   * Returns a handler that assigns the action payload to `model[key]`.
   *
   * Type-checks at the call site: the payload type must be assignable to
   * the model property's type, and the key must exist on the model.
   */
  Update<K extends string>(
    key: K,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    P extends K extends keyof M ? M[K] : never,
    S extends Env = Env,
  >(
    context: HandlerContext<M, A, D, S>,
    payload: P,
  ) => void {
    return (context, payload) => {
      context.actions.produce((draft) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (<any>draft.model)[key] = payload;
      });
    };
  },
  /**
   * Returns a handler that inverts a boolean field on the model.
   *
   * Type-checks at the call site: `model[key]` must be a boolean.
   */
  Invert<K extends string>(
    key: K,
  ): <
    M extends Model & Record<K, boolean>,
    A extends Actions | void,
    D extends Props,
    S extends Env = Env,
  >(
    context: HandlerContext<M, A, D, S>,
  ) => void {
    return (context) => {
      context.actions.produce((draft) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (<any>draft.model)[key] = !(<any>draft.model)[key];
      });
    };
  },
};
