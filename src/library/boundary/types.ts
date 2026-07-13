import type * as React from "react";
import type { Env } from "./components/env/types.ts";
import type { SseConfig } from "./components/sse/types.ts";
import type { Tap } from "./components/tap/types.ts";

/**
 * Props accepted by the bare `<Boundary>` provider.
 *
 * Most applications declare these once via {@link App} and let the
 * generated `<app.Boundary>` thread them through &mdash; the bare
 * Boundary is exposed for advanced use (custom wrappers, isolated test
 * renders) where the loose {@link Env} record type is sufficient and
 * the typed `app.useContext` / `app.useEnv` surface isn't needed.
 *
 * All fields are optional. Omit them all and the Boundary still wraps
 * its subtree with the Broadcaster, Env, Tasks, and Tap providers
 * required by every March Hare hook &mdash; just with a default empty
 * env and a no-op tap.
 */
export type Props = {
  /**
   * Initial value of the per-Boundary {@link Env}. Prefer `App({ env })`
   * &mdash; it infers the Env shape `E` and threads it through
   * `app.useContext`, `app.useEnv`, and `app.Resource`, so handler
   * `context.env` is typed accordingly. Pass `env` directly here only
   * for advanced cases where the loose record type is sufficient.
   *
   * The value is captured on mount; subsequent prop updates do not
   * replace the live env. Mutations during the boundary's lifetime
   * flow through `context.actions.produce(({ env }) => { ... })`.
   */
  env?: Env;
  /**
   * Observer invoked for every action handler lifecycle event inside
   * this Boundary. One event fires per handler invocation, not per
   * dispatch &mdash; a broadcast that reaches five subscribers
   * produces five `dispatch` events, five `settle` events, and an
   * `error` event for any of the five that throws.
   *
   * The callback is synchronous: it blocks the dispatch path until it
   * returns. Defer slow work (network transports, file IO) to a queue
   * or idle callback rather than running it inline.
   *
   * Typical uses: analytics histograms, audit-log ring buffers,
   * Sentry breadcrumbs, replay traces for bug reports. For in-band
   * error recovery use {@link Lifecycle.Fault} instead &mdash; the two
   * channels are independent. See `recipes/tap.md`.
   */
  tap?: Tap;
  /**
   * SSE endpoint configuration for omnicast actions. When supplied, the
   * Boundary owns the connection lifecycle automatically &mdash; it
   * connects on mount, disconnects on unmount, and rides `EventSource`'s
   * reconnection &mdash; and every omnicast action dispatched inside the
   * Boundary is additionally published to the wire. Omit it and omnicast
   * actions degrade gracefully to plain broadcasts.
   */
  sse?: SseConfig;
  /**
   * Subtree that should receive the boundary's broadcast, env, tasks,
   * and tap providers. Every March Hare hook called inside this
   * subtree resolves against this boundary's context.
   */
  children: React.ReactNode;
};
