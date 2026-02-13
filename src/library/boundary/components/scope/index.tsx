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
 * late-mounted components can consume it via `context.actions.consume()`.
 *
 * @param props.name - The unique name for this scope
 * @param props.children - Components within the scope boundary
 *
 * @example
 * ```tsx
 * // Create a scoped boundary
 * <Scope name="UserList">
 *   <UserFilter />
 *   <UserTable />
 * </Scope>
 *
 * // In UserFilter - dispatch to all components in "UserList" scope
 * actions.dispatch(Actions.Multicast.FilterChanged, filter, { scope: "UserList" });
 *
 * // UserTable receives the event, other components outside don't
 * ```
 *
 * @example
 * ```tsx
 * // Nested scopes - each creates its own boundary
 * <Scope name="App">
 *   <Header />
 *   <Scope name="Sidebar">
 *     <SidebarItem />
 *   </Scope>
 *   <Scope name="Content">
 *     <ContentItem />
 *   </Scope>
 * </Scope>
 *
 * // Dispatch to "Sidebar" only reaches SidebarItem
 * // Dispatch to "App" reaches all components
 * ```
 */
export function Scope({ name, children }: Props): React.ReactNode {
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
 * Eliminates the need to manually wrap component output in `<Scope name={...}>`,
 * keeping the component body focused on its own rendering logic.
 *
 * @param name - The scope name for multicast action delivery.
 * @param Component - The component to wrap.
 * @returns A new component that renders the original within a `<Scope>`.
 *
 * @example
 * ```tsx
 * export default withScope(SCOPE_NAME, function Layout(): ReactElement {
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
  name: string,
  Component: ComponentType<P>,
): (props: P) => ReactNode {
  const scopedName = `Scoped${Component.displayName || Component.name || "Component"}`;

  return {
    [scopedName](props: P): ReactNode {
      return (
        <Scope name={name}>
          <Component {...props} />
        </Scope>
      );
    },
  }[scopedName];
}
