import * as React from "react";
import type { RefObject } from "react";
import { G } from "@mobily/ts-belt";
import type { Env } from "./index.tsx";

/**
 * Internal singleton fallback used when `useEnv` is read outside any
 * `<Boundary>` (or `<Env>` provider). Reads see `{}`; writes through
 * `context.actions.produce(({ env }) => ...)` mutate this slot but
 * are not observed by any handler.
 *
 * @internal
 */
const fallback: RefObject<Env> = { current: <Env>{} };

/**
 * React context exposing the per-Boundary Env ref. The ref itself is
 * stable across renders &mdash; readers grab `.current` at call time.
 *
 * @internal
 */
export const Context = React.createContext<RefObject<Env>>(fallback);

/**
 * Hook that returns a read-only handle to the per-Boundary {@link Env}.
 * Reads use plain dot notation (`env.session`) and always reflect the
 * latest value, even after `await` boundaries &mdash; the handle is a
 * `Proxy` that delegates property access to the live ref.
 *
 * Writes are not exposed here. Mutate the Env inside an action handler
 * via `context.actions.produce(({ model, env }) => { env.x = ... })`
 * &mdash; the same Immer-style recipe used for the model. Mutations do
 * **not** trigger a re-render; drive view state through the model.
 *
 * Prefer `app.useEnv()` from an {@link App} instance &mdash; the App
 * factory infers the Env's shape from `app.env` and types every
 * read/write against it. The bare `useEnv()` exists for non-App
 * call sites and returns the loose {@link Env} record type.
 */
export function useEnv(): Env {
  const ref = React.useContext(Context);
  return React.useMemo<Env>(
    () =>
      new Proxy(<Env>{}, {
        get(_target, key) {
          return Reflect.get(ref.current, key);
        },
        has(_target, key) {
          return key in ref.current;
        },
        ownKeys() {
          return Reflect.ownKeys(ref.current);
        },
        getOwnPropertyDescriptor(_target, key) {
          const descriptor = Object.getOwnPropertyDescriptor(ref.current, key);
          if (G.isUndefined(descriptor)) return undefined;
          return { ...descriptor, configurable: true };
        },
        set() {
          throw new TypeError(
            "Env is read-only outside `context.actions.produce`. " +
              "Mutate via produce(({ env }) => { env.x = ... }) instead.",
          );
        },
      }),
    [ref],
  );
}

/**
 * Internal accessor for the per-Boundary Env ref &mdash; used by the
 * Resource layer to pass a fresh snapshot to each fetcher invocation
 * and by the action layer to write through `context.actions.produce`.
 * Not exported from the library.
 *
 * @internal
 */
export function useEnvRef(): RefObject<Env> {
  return React.useContext(Context);
}
