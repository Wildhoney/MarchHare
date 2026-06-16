import type {
  Actions,
  HandlerContext,
  Maybe,
  Model,
  Props,
} from "../types/index.ts";
import type { Env } from "../boundary/components/env/types.ts";

/**
 * Non-nullable primitive leaves that {@link Paths} can terminate on. Used
 * internally to stop the recursive walk at scalar boundaries; consumers
 * shouldn't reach for this directly.
 *
 * @internal
 */
export type Primitive = Maybe<string | number | bigint | boolean | symbol>;

/**
 * Decrement table used to cap {@link Paths} / {@link BooleanPaths}
 * recursion depth. Indexing `Depth[N]` produces `N - 1` (or `never`
 * once the budget is exhausted), keeping the type-checker tractable
 * on deeply nested models.
 *
 * @internal
 */
export type Depth = [never, 0, 1, 2, 3, 4, 5];

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
      ): <A extends Actions | void, D extends Props, E extends Env = Env>(
        context: HandlerContext<M, A, D, E>,
        payload: Get<M, K>,
      ) => void;
      invert<K extends BooleanPaths<M>>(
        key: K,
      ): <A extends Actions | void, D extends Props, E extends Env = Env>(
        context: HandlerContext<M, A, D, E>,
      ) => void;
      always<K extends Paths<M>>(
        key: K,
        value: Get<M, K>,
      ): <A extends Actions | void, D extends Props, E extends Env = Env>(
        context: HandlerContext<M, A, D, E>,
      ) => void;
    }
  : Record<string, never>;
