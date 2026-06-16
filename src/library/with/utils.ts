import type { Actions, HandlerContext, Model, Props } from "../types/index.ts";
import type { Env } from "../boundary/components/env/types.ts";
import type { WithHandle } from "./types.ts";

/**
 * Walks the lodash-style dotted `path` on `target`, stopping one segment
 * short so callers can mutate or read the leaf via the returned `cursor`
 * and `key`. Used by every assignment helper below to avoid duplicating
 * the per-segment descent.
 *
 * @internal
 */
export function walk(
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

/**
 * Assigns `value` to the leaf of `target` reached by lodash-style `path`.
 * Mutates in place &mdash; expected to be called from inside an Immer
 * `produce` draft.
 *
 * @internal
 */
export function setPath(target: unknown, path: string, value: unknown): void {
  const { cursor, key } = walk(target, path);
  cursor[key] = value;
}

/**
 * Flips the boolean leaf of `target` reached by lodash-style `path`.
 * Mutates in place &mdash; expected to be called from inside an Immer
 * `produce` draft.
 *
 * @internal
 */
export function invertPath(target: unknown, path: string): void {
  const { cursor, key } = walk(target, path);
  cursor[key] = !cursor[key];
}

/**
 * Returns a handler that assigns the dispatched payload to the model
 * leaf at lodash-style `key`. Underlies both `context.with.update` and
 * the top-level `With.Update`.
 *
 * @internal
 */
export function makeUpdate(key: string) {
  return (
    context: HandlerContext<Model, Actions, Props, Env>,
    payload: unknown,
  ) => {
    context.actions.produce((draft) => {
      setPath(draft.model, key, payload);
    });
  };
}

/**
 * Returns a handler that flips the boolean model leaf at lodash-style
 * `key`. Underlies both `context.with.invert` and `With.Invert`.
 *
 * @internal
 */
export function makeInvert(key: string) {
  return (context: HandlerContext<Model, Actions, Props, Env>) => {
    context.actions.produce((draft) => {
      invertPath(draft.model, key);
    });
  };
}

/**
 * Returns a handler that assigns the constant `value` to the model
 * leaf at lodash-style `key`, ignoring any dispatched payload.
 * Underlies both `context.with.always` and `With.Always`.
 *
 * @internal
 */
export function makeAlways(key: string, value: unknown) {
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
