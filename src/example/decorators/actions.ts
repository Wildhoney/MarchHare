import { useAction, useActions, use } from "../../library/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { Model, Actions, Action } from "./types.ts";

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
 * Called by the Reset action.
 */
export function resetRetryAttemptCount(): void {
  retryAttemptCount = 0;
}

export function useDecoratorActions() {
  /**
   * Supplant action - demonstrates that only one instance runs at a time.
   * Previous execution is aborted when called again.
   */
  const supplant = useAction<Action, "Supplant">(async (context) => {
    const id = Date.now();
    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, `supplant-start-${id}`];
    });

    await sleep(500, context.signal);

    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, `supplant-end-${id}`];
      draft.model.value += 1;
    });
  });

  /**
   * Debounce action - waits for quiet period before executing.
   * Rapid calls only result in one execution.
   */
  const debounce = useAction<Action, "Debounce">(async (context) => {
    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, "debounce-executed"];
      draft.model.value += 1;
    });
  });

  /**
   * Throttle action - rate limits execution.
   * First call executes immediately, subsequent calls during window are queued.
   */
  const throttle = useAction<Action, "Throttle">(async (context) => {
    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, `throttle-executed-${Date.now()}`];
      draft.model.value += 1;
    });
  });

  /**
   * Retry action - retries on failure with specified intervals.
   * Will eventually succeed after a few attempts.
   * Uses module-scope variable to track attempts across retries since
   * context.model is frozen at the initial call's state.
   */
  const retry = useAction<Action, "Retry">(async (context) => {
    retryAttemptCount += 1;
    const currentAttempt = retryAttemptCount;

    context.actions.produce((draft) => {
      draft.model.attempts = currentAttempt;
      draft.model.log = [...draft.model.log, `retry-attempt-${currentAttempt}`];
    });

    // Fail on first 2 attempts, succeed on 3rd
    if (currentAttempt < 3) {
      throw new Error(`Attempt ${currentAttempt} failed`);
    }

    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, "retry-success"];
      draft.model.value += 1;
    });
  });

  /**
   * Reset retry counter for testing.
   * Resets both the module-scope variable and the model state.
   */
  const reset = useAction<Action, "Reset">((context) => {
    resetRetryAttemptCount();
    context.actions.produce((draft) => {
      draft.model.attempts = 0;
    });
  });

  /**
   * Timeout action - aborts if takes too long.
   * Sleeps for 1000ms but timeout is 200ms.
   */
  const timeout = useAction<Action, "Timeout">(async (context) => {
    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, "timeout-start"];
    });

    // This will exceed the timeout
    await sleep(1000, context.signal);

    // This should never be reached
    context.actions.produce((draft) => {
      draft.model.log = [...draft.model.log, "timeout-end"];
      draft.model.value += 1;
    });
  });

  /**
   * Clear the log for fresh tests.
   */
  const clear = useAction<Action, "Clear">((context) => {
    context.actions.produce((draft) => {
      draft.model.log = [];
      draft.model.value = 0;
      draft.model.attempts = 0;
    });
  });

  return useActions<Action>(
    model,
    class {
      @use.supplant()
      [Actions.Supplant] = supplant;

      @use.debounce(300)
      [Actions.Debounce] = debounce;

      @use.throttle(500)
      [Actions.Throttle] = throttle;

      @use.retry([100, 100])
      [Actions.Retry] = retry;

      [Actions.Reset] = reset;

      @use.timeout(200)
      [Actions.Timeout] = timeout;

      [Actions.Clear] = clear;
    },
  );
}
