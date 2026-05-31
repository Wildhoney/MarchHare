import * as React from "react";
import { Broadcaster } from "./components/broadcast/index.tsx";
import { Tasks } from "./components/tasks/index.tsx";
import { Store } from "./components/store/index.tsx";
import { SharingProvider } from "./components/sharing/index.tsx";
import type { Props } from "./types.ts";

/**
 * Low-level boundary primitive. Wraps children with the Broadcaster,
 * Store, and Tasks providers required by every March Hare hook.
 *
 * Most applications should reach for {@link App} instead &mdash;
 * `App<S>({ store })` returns a typed `app.Boundary` along with
 * matching `useContext` / `useStore` / `Resource` factories that all
 * close over the App's inferred store shape `S`. The bare `Boundary`
 * is exposed for advanced or library-internal use where the loose
 * Store record type is sufficient.
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
        <Tasks>
          <SharingProvider>{children}</SharingProvider>
        </Tasks>
      </Store>
    </Broadcaster>
  );
}
