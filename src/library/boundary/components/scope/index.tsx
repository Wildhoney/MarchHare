import type { ScopeContext, ScopeEntry } from "./types.ts";
import type { MulticastPayload } from "../../../types/index.ts";
import { Context, useScope } from "./utils.ts";
import { getActionSymbol } from "../../../action/index.ts";
import type { ComponentType, ReactNode } from "react";
import { BroadcastEmitter } from "../broadcast/utils.ts";
import * as React from "react";

export { useScope, getScope } from "./utils.ts";
export type { ScopeEntry, ScopeContext } from "./types.ts";

/**
 * Higher-order component that opens a multicast scope keyed by the supplied
 * multicast action. Components rendered inside the wrapped tree (and any
 * descendants) participate in the scope: every dispatch of `action` reaches
 * every subscriber inside this boundary.
 *
 * Each multicast action defines its own scope &mdash; pass the same action you
 * declared with `Distribution.Multicast` to both `withScope` and
 * `actions.dispatch`.
 *
 * Multicast caches the most recent dispatched value per scope so late-mounted
 * components can read it via `context.actions.final()`.
 *
 * @param action - The multicast action that opens this scope.
 * @param Component - The component to wrap.
 * @returns A component that renders the original inside a fresh scope boundary.
 *
 * @example
 * ```tsx
 * export class Scope {
 *   static Mood = Action<Mood>("Mood", Distribution.Multicast);
 * }
 *
 * function Mood() {
 *   return (
 *     <>
 *       <Happy />
 *       <Sad />
 *     </>
 *   );
 * }
 *
 * export default withScope(Scope.Mood, Mood);
 * ```
 */
export function withScope<P extends object, T = unknown>(
  action: MulticastPayload<T>,
  Component: ComponentType<P>,
): (props: P) => ReactNode {
  const scopedName = `Scoped${Component.displayName || Component.name || "Component"}`;
  const symbol = getActionSymbol(action);

  return {
    [scopedName](props: P): ReactNode {
      const parent = useScope();

      const entry = React.useMemo<ScopeEntry>(
        () => ({
          action: symbol,
          emitter: new BroadcastEmitter(),
        }),
        [],
      );

      const context = React.useMemo<ScopeContext>(() => {
        const map = new Map(parent ?? []);
        map.set(symbol, entry);
        return map;
      }, [parent, entry]);

      return (
        <Context.Provider value={context}>
          <Component {...props} />
        </Context.Provider>
      );
    },
  }[scopedName];
}
