import * as React from "react";
import { Broadcaster } from "./components/broadcast/index.tsx";
import { Tasks } from "./components/tasks/index.tsx";
import { Env } from "./components/env/index.tsx";
import type { Env as EnvType } from "./components/env/types.ts";
import { SharingProvider } from "./components/sharing/index.tsx";
import { Tappable } from "./components/tap/index.tsx";
import { Context as ConsumerContext } from "./components/consumer/utils.ts";
import type { ConsumerContext as ConsumerStore } from "./components/consumer/types.ts";
import type { Props } from "./types.ts";

/**
 * Low-level boundary primitive. Wraps children with the Broadcaster,
 * Env, and Tasks providers required by every March Hare hook.
 *
 * Most applications should reach for {@link App} instead &mdash;
 * `App<E>({ env })` returns a typed `app.Boundary` along with
 * matching `useContext` / `useEnv` / `Resource` factories that all
 * close over the App's inferred env shape `E`. The bare `Boundary`
 * is exposed for advanced or library-internal use where the loose
 * Env record type is sufficient.
 *
 * @example
 * ```tsx
 * <Boundary env={{ session: null, locale: "en-GB" }}>
 *   <App />
 * </Boundary>
 * ```
 */
export function Boundary({ env, tap, children }: Props): React.ReactNode {
  const consumer = React.useMemo<ConsumerStore>(() => new Map(), []);
  return (
    <Broadcaster>
      <ConsumerContext.Provider value={consumer}>
        <Env initial={env ?? ({} as EnvType)}>
          <Tasks>
            <Tappable tap={tap}>
              <SharingProvider>{children}</SharingProvider>
            </Tappable>
          </Tasks>
        </Env>
      </ConsumerContext.Provider>
    </Broadcaster>
  );
}
