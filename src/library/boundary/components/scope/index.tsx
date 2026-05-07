import type { Props, ScopeContext, ScopeEntry } from "./types.ts";
import { Context, useScope } from "./utils.ts";
import type { ComponentType, ReactNode } from "react";
import { BroadcastEmitter } from "../broadcast/utils.ts";
import * as React from "react";

export { useScope, getScope } from "./utils.ts";
export type { ScopeEntry, ScopeContext } from "./types.ts";

/**
 * Creates a named scope boundary for multicast actions.
 *
 * Components within a `<Scope>` can dispatch multicast actions to all other
 * components within the same scope boundary. This is useful for creating
 * isolated groups of components that need to communicate without affecting
 * other parts of the application.
 *
 * Multiple scopes can be nested, and each scope name creates its own
 * communication channel. When dispatching, the nearest ancestor scope
 * with the matching name receives the event.
 *
 * Like Broadcast, multicast caches the most recent dispatched value so that
 * late-mounted components can read it via `context.actions.resolution()`.
 *
 * @param props.of - The scope name. Typically a `static Scope` literal co-located with the feature's multicast actions.
 * @param props.children - Components within the scope boundary.
 *
 * @example
 * ```tsx
 * class UserListActions {
 *   static Scope = "UserList" as const;
 *   static FilterChanged = Action<Filter>("FilterChanged", Distribution.Multicast);
 * }
 *
 * <Scope of={UserListActions.Scope}>
 *   <UserFilter />
 *   <UserTable />
 * </Scope>
 *
 * // Dispatch reaches every component in the UserList scope:
 * actions.dispatch(Actions.Multicast.FilterChanged, filter, { scope: Actions.Multicast.Scope });
 * ```
 *
 * @example
 * ```tsx
 * // Nested scopes - each class carries its own scope name
 * <Scope of={AppActions.Scope}>
 *   <Header />
 *   <Scope of={SidebarActions.Scope}>
 *     <SidebarItem />
 *   </Scope>
 *   <Scope of={ContentActions.Scope}>
 *     <ContentItem />
 *   </Scope>
 * </Scope>
 * ```
 */
export function Scope({ of: name, children }: Props): React.ReactNode {
  const parent = useScope();

  const scopeEntry = React.useMemo<ScopeEntry>(
    () => ({
      name,
      emitter: new BroadcastEmitter(),
    }),
    [],
  );

  const context = React.useMemo<ScopeContext>(() => {
    const map = new Map(parent ?? []);
    map.set(name, scopeEntry);
    return map;
  }, [parent, name, scopeEntry]);

  return <Context.Provider value={context}>{children}</Context.Provider>;
}

/**
 * Higher-order component that wraps a component in a multicast `<Scope>`.
 *
 * Eliminates the need to manually wrap component output in `<Scope of={...}>`,
 * keeping the component body focused on its own rendering logic.
 *
 * @param scope - The scope name. Typically a `static Scope` literal co-located with the feature's multicast actions.
 * @param Component - The component to wrap.
 * @returns A new component that renders the original within a `<Scope>`.
 *
 * @example
 * ```tsx
 * class MulticastActions {
 *   static Scope = "payment-link" as const;
 *   static Update = Action<User>("Update", Distribution.Multicast);
 * }
 *
 * export default withScope(MulticastActions.Scope, function Layout(): ReactElement {
 *   return (
 *     <div>
 *       <Sidebar />
 *       <Content />
 *     </div>
 *   );
 * });
 * ```
 */
export function withScope<P extends object>(
  scope: string,
  Component: ComponentType<P>,
): (props: P) => ReactNode {
  const scopedName = `Scoped${Component.displayName || Component.name || "Component"}`;

  return {
    [scopedName](props: P): ReactNode {
      return (
        <Scope of={scope}>
          <Component {...props} />
        </Scope>
      );
    },
  }[scopedName];
}
