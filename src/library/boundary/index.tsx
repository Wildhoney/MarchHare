import * as React from "react";
import { Broadcaster } from "./components/broadcast/index.tsx";
import { Tasks } from "./components/tasks/index.tsx";
import { Store } from "./components/store/index.tsx";
import type { Props } from "./types.ts";

/**
 * Creates a unified context boundary for all March Hare features.
 * Wraps children with Broadcaster, Store, and Tasks providers.
 *
 * Use this at the root of your application or to create isolated context
 * boundaries for libraries that need their own March Hare context.
 *
 * Pass the `store` prop with the initial Store value (session, locale,
 * feature flags, etc.) &mdash; the shape is determined by module
 * augmentation on the library's `Store` interface.
 *
 * @example
 * ```tsx
 * <Boundary store={{ session: null, locale: "en-GB" }}>
 *   <App />
 * </Boundary>
 * ```
 */
export function Boundary({ store, children }: Props): React.ReactNode {
  return (
    <Broadcaster>
      <Store initial={store ?? ({} as Store)}>
        <Tasks>{children}</Tasks>
      </Store>
    </Broadcaster>
  );
}
