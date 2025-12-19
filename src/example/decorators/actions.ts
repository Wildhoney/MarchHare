import { useAction, useActions, use } from "../../library/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { Model, Actions } from "./types.ts";

const model: Model = {
  value: 0,
  log: [],
  attempts: 0,
};

/**
 * Module-scope counter for retry attempts.
 * Must be at module scope to persist across React hook re-calls (e.g., Strict Mode).
 */
let retryAttemptCount = 0;

/**
 * Reset the module-scope retry counter.
 * Called by the ResetRetry action.
 */
export function resetRetryAttemptCount(): void {
  retryAttemptCount = 0;
}

export function useDecoratorActions() {
  /**
   * Supplant action - demonstrates that only one instance runs at a time.
   * Previous execution is aborted when called again.
   */
  const supplantAction = useAction<Model, typeof Actions, "SupplantAction">(
    async (context) => {
      const id = Date.now();
      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, `supplant-start-${id}`];
      });

      await sleep(500, context.signal);

      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, `supplant-end-${id}`];
        m.value += 1;
      });
    },
  );

  /**
   * Debounce action - waits for quiet period before executing.
   * Rapid calls only result in one execution.
   */
  const debounceAction = useAction<Model, typeof Actions, "DebounceAction">(
    async (context) => {
      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, "debounce-executed"];
        m.value += 1;
      });
    },
  );

  /**
   * Throttle action - rate limits execution.
   * First call executes immediately, subsequent calls during window are queued.
   */
  const throttleAction = useAction<Model, typeof Actions, "ThrottleAction">(
    async (context) => {
      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, `throttle-executed-${Date.now()}`];
        m.value += 1;
      });
    },
  );

  /**
   * Retry action - retries on failure with specified intervals.
   * Will eventually succeed after a few attempts.
   * Uses module-scope variable to track attempts across retries since
   * context.model is frozen at the initial call's state.
   */
  const retryAction = useAction<Model, typeof Actions, "RetryAction">(
    async (context) => {
      retryAttemptCount += 1;
      const currentAttempt = retryAttemptCount;

      context.actions.produce(({ model: m }) => {
        m.attempts = currentAttempt;
        m.log = [...m.log, `retry-attempt-${currentAttempt}`];
      });

      // Fail on first 2 attempts, succeed on 3rd
      if (currentAttempt < 3) {
        throw new Error(`Attempt ${currentAttempt} failed`);
      }

      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, "retry-success"];
        m.value += 1;
      });
    },
  );

  /**
   * Reset retry counter for testing.
   * Resets both the module-scope variable and the model state.
   */
  const resetRetry = useAction<Model, typeof Actions, "ResetRetry">(
    (context) => {
      resetRetryAttemptCount();
      context.actions.produce(({ model: m }) => {
        m.attempts = 0;
      });
    },
  );

  /**
   * Timeout action - aborts if takes too long.
   * Sleeps for 1000ms but timeout is 200ms.
   */
  const timeoutAction = useAction<Model, typeof Actions, "TimeoutAction">(
    async (context) => {
      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, "timeout-start"];
      });

      // This will exceed the timeout
      await sleep(1000, context.signal);

      // This should never be reached
      context.actions.produce(({ model: m }) => {
        m.log = [...m.log, "timeout-end"];
        m.value += 1;
      });
    },
  );

  /**
   * Clear the log for fresh tests.
   */
  const clearLog = useAction<Model, typeof Actions, "ClearLog">((context) => {
    context.actions.produce(({ model: m }) => {
      m.log = [];
      m.value = 0;
      m.attempts = 0;
    });
  });

  return useActions<Model, typeof Actions>(
    model,
    class {
      @use.supplant()
      [Actions.SupplantAction] = supplantAction;

      @use.debounce(300)
      [Actions.DebounceAction] = debounceAction;

      @use.throttle(500)
      [Actions.ThrottleAction] = throttleAction;

      @use.retry([100, 100])
      [Actions.RetryAction] = retryAction;

      [Actions.ResetRetry] = resetRetry;

      @use.timeout(200)
      [Actions.TimeoutAction] = timeoutAction;

      [Actions.ClearLog] = clearLog;
    },
  );
}
