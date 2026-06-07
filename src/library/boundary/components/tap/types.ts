import type * as React from "react";
import type { Reason } from "../../../error/types.ts";
import type { Task } from "../tasks/types.ts";

/**
 * Identity of a handler invocation: the action being handled and the
 * payload supplied at dispatch. Appears on every {@link Tapped} event
 * as `event.action`, alongside the `stage` / `result` discriminators.
 */
export type Invocation = {
  /** Human-readable name of the action being handled. */
  readonly name: string;
  /** Payload supplied at dispatch (typed `unknown`; cast at the call site). */
  readonly payload: unknown;
};

/**
 * Failure fields layered onto the `details` sub-object of the
 * `end:error` variant of {@link Tapped}. Groups the thrown error with
 * the {@link Reason} the dispatch pipeline classified it as &mdash;
 * consumers branching on `Aborted` vs. `Errored` read both off the
 * same place. The error variant's `details` is `Failure` merged with
 * the common end-of-handler shape (`{ mutations }`), so a helper that
 * takes a `Failure` accepts the error-variant `details` directly.
 */
export type Failure = {
  /** The Error instance thrown by the handler (or the abort cause). */
  readonly error: Error;
  /** Library classification of the failure: `Aborted` or `Errored`. */
  readonly reason: Reason;
};

/**
 * Reference snapshot for a single mutation surface (model or env)
 * captured at handler start and end. The library compares references
 * &mdash; Immer / Immertation produce a new reference iff a `produce`
 * call actually committed a change, so reference inequality is a
 * precise "did something change" signal with no deep-diff cost.
 *
 * Consumers diff `before` against `after` themselves (using the
 * library's `changes` helper, a third-party diff lib, or a custom
 * walk) when they need the per-field delta.
 */
export type Snapshot<T> = {
  readonly before: T;
  readonly after: T;
};

/**
 * Per-handler summary of which mutation surfaces changed during the
 * invocation. `null` on a surface means "reference unchanged" &mdash;
 * the handler did not commit any `produce` call that touched that
 * surface. A non-null value carries the before/after references.
 *
 * Values are typed `unknown` at this seam because the library doesn't
 * know the model or env shape; cast inside the tap callback at the
 * boundary where you know your `App`'s typed shape.
 *
 * Note on nested dispatches: if a handler awaits a sibling dispatch
 * that itself mutates the same surface, the outer handler's
 * `mutations` reflects the net change observed across its lifetime
 * &mdash; including downstream effects. This is usually what you want
 * for tracing; if you need to attribute changes to the originating
 * handler precisely, branch on the `action` field as well.
 */
export type Mutations = {
  readonly model: Snapshot<unknown> | null;
  readonly env: Snapshot<unknown> | null;
};

/**
 * Lifecycle event published by the tap. One pair of events is emitted
 * per handler invocation, not per dispatch &mdash; a broadcast that
 * reaches five subscribers produces five `start` events plus one `end`
 * event per subscriber.
 *
 * The shape is a two-level discrimination:
 *
 * - **`stage`** &mdash; `"start"` (handler just began) or `"end"`
 *   (handler completed).
 * - **`result`** &mdash; on `end` only, `"success"` or `"error"`
 *   describing the outcome. Mutually exclusive: the same handler
 *   invocation never produces both a success and an error.
 *
 * Per handler, exactly one of these two pairs is emitted:
 * - **Succeeded:** `stage: "start"` &rarr; `stage: "end", result: "success"`.
 * - **Failed:** `stage: "start"` &rarr; `stage: "end", result: "error"`.
 *
 * The {@link Invocation} identity (`action`, `payload`) and the
 * discriminators (`stage`, `result`) sit at the top level so consumers
 * can route and label events without diving into `details`. Everything
 * else &mdash; the task handle, timing, mutation summary, failure
 * info &mdash; lives on the `details` sub-object.
 *
 * `start` events carry just the {@link Task} in `details`;
 * `end:success` adds `elapsed` and {@link Mutations}; `end:error`
 * adds those plus the {@link Failure} fields.
 *
 * `elapsed` is measured in milliseconds against `performance.now()`,
 * captured the moment the `end` event fires.
 */
export type Tapped = {
  /** Action being handled: `{ name, payload }`. */
  readonly action: Invocation;
} & (
  | { readonly stage: "start"; readonly details: { readonly task: Task } }
  | {
      readonly stage: "end";
      readonly result: "success";
      readonly details: {
        readonly task: Task;
        readonly elapsed: number;
        readonly mutations: Mutations;
      };
    }
  | {
      readonly stage: "end";
      readonly result: "error";
      readonly details: Failure & {
        readonly task: Task;
        readonly elapsed: number;
        readonly mutations: Mutations;
      };
    }
);

/**
 * Observer callback invoked for every action handler lifecycle event
 * inside the surrounding `<Boundary>`. Synchronous &mdash; do not
 * perform expensive or async work here; defer to a queue, ring buffer,
 * or external transport if the receiver is slow.
 *
 * Tap is intended for cross-cutting observability concerns: analytics,
 * audit logging, browser-extension devtools, Sentry breadcrumbs,
 * replay traces for bug reports. Use {@link Lifecycle.Fault} for
 * in-band error recovery; the two are independent.
 */
export type Tap = (event: Tapped) => void;

/**
 * Props accepted by the internal {@link Tappable} provider. The provider
 * stores the supplied `tap` callback behind a ref so a parent re-render
 * that changes the callback identity does not invalidate the React
 * context value &mdash; every dispatch reads the latest callback at
 * fire time.
 */
export type Props = {
  /**
   * Observer invoked for every action handler lifecycle event inside
   * the surrounding `<Boundary>`. Omit (or pass `undefined`) to
   * disable observation &mdash; the dispatch path then pays only the
   * cost of a single function call per handler invocation.
   */
  tap?: Tap;
  children: React.ReactNode;
};
