# Boundary tap

`tap` is a synchronous observer that fires for every action handler invocation inside the boundary. It is the single seam for cross-cutting observability: analytics, audit logging, devtools panels, Sentry breadcrumbs, replay traces for bug reports.

The tap is intentionally low-level. It does not classify events as "interesting", does not buffer them, does not retry. Consumers compose those concerns on top &mdash; the library only guarantees the firing contract.

## Wiring it in

Pass `tap` to `App()` next to `env` &mdash; this is where bootstrap-time configuration lives and where Sentry / analytics SDK handles are already set up.

```ts
// app.ts
import { App, type Taps } from "march-hare";

function tap(event: Taps) {
  if (event.stage === "start") {
    console.debug(`[${event.action.name}] started`, event.action.payload);
    return;
  }
  if (event.result === "success") {
    console.debug(
      `[${event.action.name}] succeeded in ${event.details.elapsed}ms`,
    );
    return;
  }
  console.error(
    `[${event.action.name}] errored after ${event.details.elapsed}ms`,
    event.details.error,
  );
}

export const app = App({
  env: { session: null, locale: "en-GB" },
  tap,
});
```

`<app.Boundary>` then renders with no extra props at the root:

```tsx
<app.Boundary>
  <Root />
</app.Boundary>
```

Both `env` and `tap` are fixed at `App()` time; `<app.Boundary>` deliberately does not accept overrides. If a test render or storybook needs a different initial Env or a spy tap, declare a separate `App` with that configuration and render its boundary instead.

For low-level scenarios where you have not adopted `App()`, the bare `<Boundary tap={...}>` accepts the same callback &mdash; `App()` is just the typed wrapper around it.

The boundary re-renders without invalidating the tap context when the callback identity changes &mdash; the provider stores the callback in a ref, so inline arrow functions are safe.

## Firing contract

Events are emitted **per handler invocation**, not per dispatch. A broadcast that reaches five subscribers produces five independent event streams &mdash; each stream is exactly two events, with a mutually-exclusive terminal.

The shape is a two-level discrimination:

- **`stage`** &mdash; `"start"` (handler began) or `"end"` (handler completed).
- **`result`** &mdash; on `end` only, `"success"` or `"error"`.

Per handler:

- **Succeeded:** `stage: "start"` &rarr; `stage: "end", result: "success"`.
- **Failed:** `stage: "start"` &rarr; `stage: "end", result: "error"`.

Every event carries `action: { name, payload }` at the top level. Everything else &mdash; `task`, `elapsed`, `mutations`, and (on errors) `error` / `reason` &mdash; lives on `details`. Consumers branch on `stage === "end"` to access timing and mutation info; on `result === "error"` to access failure info.

`elapsed` is measured against `performance.now()` in milliseconds, computed the moment the `end` event fires.

## Tap vs. `Lifecycle.Fault`

These two channels look similar but exist for different reasons.

- **`Lifecycle.Fault`** is an in-band recovery channel: handlers subscribe to it to react (sign out on auth failure, abort dependent tasks, surface a toast). It only fires on errors.
- **`tap`** is an out-of-band observability channel: it sees every handler start and every end (success or error). It is not intended to mutate model state or dispatch follow-up actions.

Subscribe to both. Faults handle the consequences of failure; the tap records that failure for the people running the application.

## Analytics: per-action timing

A common use is feeding action timings into an analytics or APM pipeline:

```ts
import { Boundary, type Taps } from "march-hare";
import { metrics } from "./instrumentation";

function tap(event: Taps) {
  if (event.stage !== "end") return;
  metrics.histogram("action.duration_ms", event.details.elapsed, {
    action: event.action.name,
    outcome: event.result,
  });
}

<Boundary tap={tap}>
  <App />
</Boundary>;
```

Branching on `stage === "end"` narrows the event to either result variant, exposing `elapsed` and `result`. The `start` events carry no `elapsed`, so they're filtered out at the top of the callback.

## Audit log: dispatched action trace

For a flight-recorder style trace that surfaces in bug reports, keep a ring buffer of recent events:

```ts
import { Boundary, type Taps } from "march-hare";

const trace: Taps[] = [];
const limit = 200;

function tap(event: Taps) {
  // eslint-disable-next-line fp/no-mutating-methods
  trace.push(event);
  if (trace.length > limit) {
    // eslint-disable-next-line fp/no-mutating-methods
    trace.shift();
  }
}

// Attach to bug-report submissions or expose via window for support tooling.
window.marchHareTrace = () => trace;

<Boundary tap={tap}>
  <App />
</Boundary>;
```

A 200-event window is roughly the last few seconds of dispatch activity for a busy application &mdash; tune to taste. Keep the structure simple: the value of this buffer is being able to ask "what happened just before this exception?", not running queries against it.

## Sentry breadcrumbs

```ts
import * as Sentry from "@sentry/react";
import { Boundary, type Taps } from "march-hare";

function tap(event: Taps) {
  if (event.stage === "start") {
    Sentry.addBreadcrumb({
      category: "march-hare",
      message: event.action.name,
      level: "info",
      data: { payload: event.action.payload },
    });
    return;
  }
  if (event.result === "error") {
    Sentry.captureException(event.details.error, {
      tags: {
        action: event.action.name,
        reason: String(event.details.reason),
      },
      extra: {
        elapsed: event.details.elapsed,
        payload: event.action.payload,
      },
    });
  }
}

<Boundary tap={tap}>
  <App />
</Boundary>;
```

Subscribing to `start` events (for breadcrumbs) and `result === "error"` (for captures) keeps the Sentry stream readable &mdash; one entry per action started, plus an explicit capture for failures.

## What the tap does not see

- **Cached broadcast replays on mount** that hit `useAction` handlers do fire the tap &mdash; the replay path goes through the same `createHandler` wrapper.
- **Direct `peek()` and `final()` reads** do **not** fire the tap &mdash; these are read-only operations against the broadcast cache, not handler invocations.
- **`context.actions.resource(...)` calls** fire the tap once for the outer handler. The fetcher itself runs inside that handler's lifetime; it does not produce its own tap events.
- **Generator handlers** fire a single `start` event and a single matching `end` event when the generator finishes. The tap does not see individual yields.

## Performance

The tap is synchronous &mdash; the handler invocation is blocked until the callback returns. If the receiver is slow (writing to disk, calling a network API), push to an in-memory queue and drain it elsewhere:

```ts
const queue: Taps[] = [];

function tap(event: Taps) {
  // eslint-disable-next-line fp/no-mutating-methods
  queue.push(event);
  scheduleFlush();
}

function scheduleFlush() {
  // requestIdleCallback / setTimeout / SharedWorker — drain queue without
  // blocking the dispatch path.
}
```

If no `tap` prop is provided, the internal observer is a no-op &mdash; the dispatch path pays only the cost of a single function call per handler invocation.
