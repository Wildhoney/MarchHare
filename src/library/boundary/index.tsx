import * as React from "react";
import { Broadcaster } from "./components/broadcast/index.tsx";
import { Consumer } from "./components/consumer/index.tsx";
import { CacheProvider } from "./components/cache/index.tsx";
import { Tasks } from "./components/tasks/index.tsx";
import type { Props } from "./types.ts";

/**
 * Creates a unified context boundary for all Chizu features.
 * Wraps children with Broadcaster, Consumer, Cache, and Tasks providers.
 *
 * Use this at the root of your application or to create isolated context boundaries
 * for libraries that need their own Chizu context.
 *
 * @param props.children - The children to render within the boundary.
 * @returns The children wrapped in all required context providers.
 *
 * @example
 * ```tsx
 * <Boundary>
 *   <App />
 * </Boundary>
 * ```
 */
export function Boundary({ children }: Props): React.ReactNode {
  return (
    <Broadcaster>
      <Consumer>
        <CacheProvider>
          <Tasks>{children}</Tasks>
        </CacheProvider>
      </Consumer>
    </Broadcaster>
  );
}
