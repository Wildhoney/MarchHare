import * as React from "react";
import type { RefObject } from "react";

/**
 * Internal singleton fallback used when `useMode` is read outside any
 * `<Boundary>` (or `<Mode>` provider). Writes outside a Boundary still
 * mutate this slot, but they are not observed by any handler.
 *
 * @internal
 */
const fallback: RefObject<unknown> = { current: null };

/**
 * React context exposing the per-Boundary mode handle. The handle itself
 * is stable across renders &mdash; readers grab `.current` at call time.
 *
 * @internal
 */
export const Context = React.createContext<RefObject<unknown>>(fallback);

/**
 * Handle returned by {@link useMode}. Reads always reflect the latest
 * write, even after `await` boundaries.
 */
export type ModeHandle<T> = {
  read(): T | null;
  update(value: T | null): void;
};

/**
 * Hook that returns a `{ read, update }` handle to the per-Boundary mode
 * value.
 *
 * Mode is a single mutable value shared across every component inside the
 * surrounding `<Boundary>`. It is **not** reactive &mdash; mutating it does
 * not trigger a re-render. Use it for coordinating between async action
 * handlers (e.g. short-circuiting refreshes during sign-out).
 *
 * Pass the handle through the {@link useActions} `data` callback so it
 * shows up under `context.data` inside handlers, fully typed.
 *
 * @example
 * ```ts
 * enum Mode {
 *   Idle,
 *   SigningOut,
 * }
 *
 * function useSignOutActions() {
 *   const mode = useMode<Mode>();
 *   const actions = useActions<Model, typeof Actions>(model, () => ({ mode }));
 *
 *   actions.useAction(Actions.SignOut, async (context) => {
 *     context.data.mode.update(Mode.SigningOut);
 *     await api.signOut();
 *     context.data.mode.update(Mode.Idle);
 *   });
 *
 *   actions.useAction(Actions.Refresh, async (context) => {
 *     if (context.data.mode.read() === Mode.SigningOut) return;
 *     // ...
 *   });
 *
 *   return actions;
 * }
 * ```
 */
export function useMode<T>(): ModeHandle<T> {
  const ref = React.useContext(Context);
  return React.useMemo<ModeHandle<T>>(
    () => ({
      read(): T | null {
        return <T | null>ref.current;
      },
      update(value: T | null): void {
        // eslint-disable-next-line fp/no-mutation
        ref.current = value;
      },
    }),
    [ref],
  );
}
