import * as React from "react";
import type { RefObject } from "react";
import type { Store } from "./index.tsx";

/**
 * Internal singleton fallback used when `useStore` is read outside any
 * `<Boundary>` (or `<Store>` provider). Reads see `{}`; writes through
 * `context.actions.produce(({ store }) => ...)` mutate this slot but
 * are not observed by any handler.
 *
 * @internal
 */
const fallback: RefObject<Store> = { current: <Store>{} };

/**
 * React context exposing the per-Boundary Store ref. The ref itself is
 * stable across renders &mdash; readers grab `.current` at call time.
 *
 * @internal
 */
export const Context = React.createContext<RefObject<Store>>(fallback);

/**
 * Hook that returns a read-only handle to the per-Boundary {@link Store}.
 * Reads use plain dot notation (`store.session`) and always reflect the
 * latest value, even after `await` boundaries &mdash; the handle is a
 * `Proxy` that delegates property access to the live ref.
 *
 * Writes are not exposed here. Mutate the Store inside an action handler
 * via `context.actions.produce(({ model, store }) => { store.x = ... })`
 * &mdash; the same Immer-style recipe used for the model. Mutations do
 * **not** trigger a re-render; drive view state through the model.
 *
 * The Store's shape is declared via module augmentation on the library's
 * {@link Store} interface, so dot reads are fully typed at every call
 * site.
 *
 * @example
 * ```ts
 * declare module "march-hare" {
 *   interface Store {
 *     session: Session | null;
 *     locale: string;
 *   }
 * }
 *
 * function useAuthActions() {
 *   const store = useStore();
 *   const actions = useActions<void, typeof Actions>();
 *
 *   actions.useAction(Actions.SignIn, async (context, credentials) => {
 *     const result = await context.actions.resource(signIn(credentials));
 *     context.actions.produce(({ store }) => {
 *       store.session = result;
 *     });
 *   });
 *
 *   actions.useAction(Actions.Refresh, async (context) => {
 *     if (store.session === null) return;
 *     // ...
 *   });
 *
 *   return actions;
 * }
 * ```
 */
export function useStore(): Store {
  const ref = React.useContext(Context);
  return React.useMemo<Store>(
    () =>
      new Proxy(<Store>{}, {
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
          if (descriptor === undefined) return undefined;
          return { ...descriptor, configurable: true };
        },
        set() {
          throw new TypeError(
            "Store is read-only outside `context.actions.produce`. " +
              "Mutate via produce(({ store }) => { store.x = ... }) instead.",
          );
        },
      }),
    [ref],
  );
}

/**
 * Internal accessor for the per-Boundary Store ref &mdash; used by the
 * Resource layer to pass a fresh snapshot to each fetcher invocation
 * and by the action layer to write through `context.actions.produce`.
 * Not exported from the library.
 *
 * @internal
 */
export function useStoreRef(): RefObject<Store> {
  return React.useContext(Context);
}
