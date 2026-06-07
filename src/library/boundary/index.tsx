import * as React from "react";
import { Broadcaster } from "./components/broadcast/index.tsx";
import { Tasks } from "./components/tasks/index.tsx";
import { Env } from "./components/env/index.tsx";
import { SharingProvider } from "./components/sharing/index.tsx";
import { Tappable } from "./components/tap/index.tsx";
import type { Props } from "./types.ts";

/**
 * Low-level boundary primitive. Wraps children with the Broadcaster,
 * Env, and Tasks providers required by every March Hare hook.
 *
 * Most applications should reach for {@link App} instead &mdash;
 * `App<S>({ env })` returns a typed `app.Boundary` along with
 * matching `useContext` / `useEnv` / `Resource` factories that all
 * close over the App's inferred env shape `S`. The bare `Boundary`
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
  return (
    <Broadcaster>
      <Env initial={env ?? ({} as Env)}>
        <Tasks>
          <Tappable tap={tap}>
            <SharingProvider>{children}</SharingProvider>
          </Tappable>
        </Tasks>
      </Env>
    </Broadcaster>
  );
}
