/**
 * Wraps `promise` so that aborting `signal` rejects the returned
 * promise with `signal.reason`, even when `promise` itself never
 * settles. The original promise is left alone &mdash; the underlying
 * work continues (other awaiters keep their grip) and only this
 * caller's view of it is severed.
 *
 * Used by the default coalesce path: a shared in-flight fetch runs on
 * a detached `AbortController` so one caller's abort does not cancel
 * work the other callers are still waiting on, while each caller's own
 * `context.task.controller` still aborts its personal await via this
 * wrapper. The `{ once: true }` listener and the cleanup on settle keep
 * the wrapper free of leaks across long-lived signals.
 *
 * @internal
 */
export function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}
