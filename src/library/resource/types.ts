import type { Store } from "../boundary/components/store/index.tsx";

/**
 * Args object passed to every {@link Fetcher}. The fetcher destructures
 * whatever it needs; unused fields can be omitted.
 *
 * - `store` &mdash; snapshot of the per-`<Boundary>` Store at the
 *   moment the fetcher is invoked.
 * - `controller` &mdash; the `AbortController` auto-threaded from the
 *   calling handler's `context.task.controller`. Pass
 *   `controller.signal` to `fetch`/`ky`/`EventSource`, or call
 *   `controller.abort()` to fail fast.
 * - `params` &mdash; the call-site params object. Defaults to `{}`.
 *
 * @internal
 */
export type Args<P extends object = Record<never, never>> = {
  readonly store: Store;
  readonly controller: AbortController;
  readonly params: P;
};

/**
 * Fetcher signature accepted by `Resource`. Receives the args object
 * `{ store, controller, params }`. Side-effects (dispatching broadcasts,
 * analytics, etc.) belong in the calling `useAction` handler, not
 * inside the fetcher.
 */
export type Fetcher<T, P extends object = Record<never, never>> = (
  args: Args<P>,
) => Promise<T>;
