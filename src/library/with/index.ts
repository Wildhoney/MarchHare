import type {
  Actions,
  HandlerContext,
  Maybe,
  Model,
  Props,
} from "../types/index.ts";
import type { Env } from "../boundary/components/env/index.tsx";

type Primitive = Maybe<string | number | bigint | boolean | symbol>;

type Depth = [never, 0, 1, 2, 3, 4, 5];

/**
 * Lodash-style dotted paths reachable from `T`. Yields `"a"`, `"a.b"`,
 * `"items.0"`, `"items.0.name"`, etc. Recursion is capped at depth 5 to
 * keep the type-checker tractable on deeply nested models.
 *
 * @template T The object type to enumerate paths from.
 * @template D Recursion budget (internal).
 */
export type Paths<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends Primitive
    ? never
    : T extends ReadonlyArray<infer U>
      ?
          | `${number}`
          | (U extends Primitive ? never : `${number}.${Paths<U, Depth[D]>}`)
      : T extends object
        ? {
            [K in Extract<keyof T, string>]: T[K] extends Primitive
              ? K
              : K | `${K}.${Paths<T[K], Depth[D]>}`;
          }[Extract<keyof T, string>]
        : never;

/**
 * Subset of {@link Paths} whose leaf type is `boolean`. Used by
 * `context.with.invert` (and the legacy {@link With.Invert}) to restrict the
 * key to togglable fields only.
 *
 * @template T The object type to enumerate boolean leaves from.
 * @template D Recursion budget (internal).
 */
export type BooleanPaths<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends Primitive
    ? never
    : T extends ReadonlyArray<infer U>
      ?
          | (U extends boolean ? `${number}` : never)
          | (U extends Primitive
              ? never
              : `${number}.${BooleanPaths<U, Depth[D]>}`)
      : T extends object
        ? {
            [K in Extract<keyof T, string>]: T[K] extends boolean
              ? K
              : T[K] extends Primitive
                ? never
                : `${K}.${BooleanPaths<T[K], Depth[D]>}`;
          }[Extract<keyof T, string>]
        : never;

/**
 * Resolves the leaf type at a dotted path on `T`. `Get<{a:{b:number}},"a.b">`
 * is `number`; `Get<{items: string[]},"items.0">` is `string`.
 *
 * @template T The object type to walk.
 * @template P The dotted path string.
 */
export type Get<T, P extends string> = P extends `${infer Head}.${infer Tail}`
  ? T extends ReadonlyArray<infer U>
    ? Head extends `${number}`
      ? Get<U, Tail>
      : never
    : Head extends keyof T
      ? Get<T[Head], Tail>
      : never
  : T extends ReadonlyArray<infer U>
    ? P extends `${number}`
      ? U
      : never
    : P extends keyof T
      ? T[P]
      : never;

function walk(
  target: unknown,
  path: string,
): { cursor: Record<string, unknown>; key: string } {
  const segments = path.split(".");
  let cursor = <Record<string, unknown>>target;
  for (let i = 0; i < segments.length - 1; i++) {
    cursor = <Record<string, unknown>>cursor[segments[i]];
  }
  return { cursor, key: segments[segments.length - 1] };
}

function setPath(target: unknown, path: string, value: unknown): void {
  const { cursor, key } = walk(target, path);
  cursor[key] = value;
}

function invertPath(target: unknown, path: string): void {
  const { cursor, key } = walk(target, path);
  cursor[key] = !cursor[key];
}

/**
 * Returned by `context.with` &mdash; a typed bag of handler factories
 * bound to the model `M` declared in `useContext<M, …>()`. Methods accept
 * lodash-style dotted paths (`"a.b.c"`) with array indices (`"items.0.id"`).
 *
 * - `update(key)` &mdash; assigns the dispatched payload to `model[key]`.
 * - `invert(key)` &mdash; flips a boolean leaf at `model[key]`.
 * - `always(key, value)` &mdash; assigns a fixed `value` to `model[key]`,
 *   ignoring any dispatched payload.
 *
 * @template M The model type to bind keys against.
 */
export type WithHandle<M> = M extends Model
  ? {
      update<K extends Paths<M>>(
        key: K,
      ): <A extends Actions | void, D extends Props, S extends Env = Env>(
        context: HandlerContext<M, A, D, S>,
        payload: Get<M, K>,
      ) => void;
      invert<K extends BooleanPaths<M>>(
        key: K,
      ): <A extends Actions | void, D extends Props, S extends Env = Env>(
        context: HandlerContext<M, A, D, S>,
      ) => void;
      always<K extends Paths<M>>(
        key: K,
        value: Get<M, K>,
      ): <A extends Actions | void, D extends Props, S extends Env = Env>(
        context: HandlerContext<M, A, D, S>,
      ) => void;
    }
  : Record<string, never>;

function makeUpdate(key: string) {
  return (
    context: HandlerContext<Model, Actions, Props, Env>,
    payload: unknown,
  ) => {
    context.actions.produce((draft) => {
      setPath(draft.model, key, payload);
    });
  };
}

function makeInvert(key: string) {
  return (context: HandlerContext<Model, Actions, Props, Env>) => {
    context.actions.produce((draft) => {
      invertPath(draft.model, key);
    });
  };
}

function makeAlways(key: string, value: unknown) {
  return (context: HandlerContext<Model, Actions, Props, Env>) => {
    context.actions.produce((draft) => {
      setPath(draft.model, key, value);
    });
  };
}

/**
 * Builds the {@link WithHandle} object returned via `context.with`. The
 * runtime is identical for any model &mdash; only the call-site types differ.
 *
 * @internal
 */
export function bindWith<M extends Model | void>(): WithHandle<M> {
  return <WithHandle<M>>(<unknown>{
    update<K extends string>(key: K) {
      return makeUpdate(key);
    },
    invert<K extends string>(key: K) {
      return makeInvert(key);
    },
    always<K extends string>(key: K, value: unknown) {
      return makeAlways(key, value);
    },
  });
}

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
   */
  Update<K extends string>(
    key: K,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    P extends K extends Paths<M> ? Get<M, K> : never,
    S extends Env = Env,
  >(
    context: HandlerContext<M, A, D, S>,
    payload: P,
  ) => void {
    return <(context: unknown, payload: unknown) => void>makeUpdate(key);
  },
  /**
   * Returns a handler that inverts a boolean leaf at the given lodash-style
   * path. The leaf must be a `boolean` on the model.
   */
  Invert<K extends string>(
    key: K,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    S extends Env = Env,
  >(
    context: K extends BooleanPaths<M> ? HandlerContext<M, A, D, S> : never,
  ) => void {
    return <(context: unknown) => void>makeInvert(key);
  },
  /**
   * Returns a handler that assigns a fixed `value` to the model leaf at the
   * given lodash-style path. The dispatched payload (if any) is ignored.
   */
  Always<K extends string, V>(
    key: K,
    value: V,
  ): <
    M extends Model,
    A extends Actions | void,
    D extends Props,
    S extends Env = Env,
  >(
    context: K extends Paths<M>
      ? V extends Get<M, K>
        ? HandlerContext<M, A, D, S>
        : never
      : never,
  ) => void {
    return <(context: unknown) => void>makeAlways(key, value);
  },
};
