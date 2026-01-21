/**
 * E2E Test Fixtures for Rules 20-22: Task Management
 *
 * Rule 20: Use the abort signal for cancellation
 * Rule 21: Cancel competing tasks explicitly
 * Rule 22: State updates are blocked after unmount
 */
import * as React from "react";
import {
  Action,
  useActions,
  utils,
  Lifecycle,
} from "../../../src/library/index.ts";

class TaskActions {
  static FetchWithSignal = Action<string>("FetchWithSignal");
  static CompetingFetch = Action<number>("CompetingFetch");
  static CancelOthers = Action("CancelOthers");
  static SlowOperation = Action("SlowOperation");
  static GetTaskCount = Action("GetTaskCount");
}

type TaskModel = {
  fetchResult: string;
  fetchStatus: string;
  competingResults: string[];
  activeTaskCount: number;
  slowOpStatus: string;
  cancelled: boolean;
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useRule20Actions() {
  const actions = useActions<TaskModel, typeof TaskActions>({
    fetchResult: "",
    fetchStatus: "idle",
    competingResults: [],
    activeTaskCount: 0,
    slowOpStatus: "idle",
    cancelled: false,
  });

  actions.useAction(TaskActions.FetchWithSignal, async (context, url) => {
    const { signal } = context.task.controller;

    context.actions.produce((draft) => {
      draft.model.fetchStatus = "loading";
      draft.model.cancelled = false;
    });

    try {
      // Simulate fetch with abort signal
      await utils.sleep(1000, signal);

      if (signal.aborted) {
        context.actions.produce((draft) => {
          draft.model.fetchStatus = "cancelled";
          draft.model.cancelled = true;
        });
        return;
      }

      context.actions.produce((draft) => {
        draft.model.fetchResult = `Fetched: ${url}`;
        draft.model.fetchStatus = "success";
      });
    } catch (e) {
      if (signal.aborted) {
        context.actions.produce((draft) => {
          draft.model.fetchStatus = "cancelled";
          draft.model.cancelled = true;
        });
      }
    }
  });

  // Action to manually cancel
  actions.useAction(TaskActions.CancelOthers, (context) => {
    for (const task of context.tasks) {
      if (task.action === TaskActions.FetchWithSignal) {
        task.controller.abort();
      }
    }
    // Immediately update state since the aborted task's produce() may be blocked
    context.actions.produce((draft) => {
      draft.model.fetchStatus = "cancelled";
      draft.model.cancelled = true;
    });
  });

  return actions;
}

function useRule21Actions() {
  const actions = useActions<TaskModel, typeof TaskActions>({
    fetchResult: "",
    fetchStatus: "idle",
    competingResults: [],
    activeTaskCount: 0,
    slowOpStatus: "idle",
    cancelled: false,
  });

  actions.useAction(TaskActions.CompetingFetch, async (context, id) => {
    // Cancel all other tasks for this action type and log their cancellation
    // (aborted tasks can't log their own cancellation since produce() is blocked)
    const cancelledIds: number[] = [];
    for (const task of context.tasks) {
      if (task !== context.task && task.action === TaskActions.CompetingFetch) {
        // Extract the id from the task's payload
        const taskId = task.payload as number;
        cancelledIds.push(taskId);
        task.controller.abort();
      }
    }

    const { signal } = context.task.controller;

    // Log this task starting, and any tasks we just cancelled
    context.actions.produce((draft) => {
      const results = [...draft.model.competingResults, `started:${id}`];
      for (const cancelledId of cancelledIds) {
        results.push(`cancelled:${cancelledId}`);
      }
      draft.model.competingResults = results;
    });

    try {
      await utils.sleep(800, signal);

      if (signal.aborted) {
        // Can't log here - produce() is blocked for aborted tasks
        return;
      }

      context.actions.produce((draft) => {
        draft.model.competingResults = [
          ...draft.model.competingResults,
          `completed:${id}`,
        ];
      });
    } catch {
      // Can't log here - produce() is blocked for aborted tasks
    }
  });

  actions.useAction(TaskActions.GetTaskCount, (context) => {
    context.actions.produce((draft) => {
      draft.model.activeTaskCount = context.tasks.size;
    });
  });

  return actions;
}

function useUnmountableChildActions(onLog: (msg: string) => void) {
  const actions = useActions<TaskModel, typeof TaskActions>({
    fetchResult: "",
    fetchStatus: "idle",
    competingResults: [],
    activeTaskCount: 0,
    slowOpStatus: "idle",
    cancelled: false,
  });

  actions.useAction(TaskActions.SlowOperation, async (context) => {
    const { signal } = context.task.controller;

    context.actions.produce((draft) => {
      draft.model.slowOpStatus = "started";
    });
    onLog("started");

    try {
      // Long operation - component may unmount during this
      await utils.sleep(2000, signal);

      // This produce() should be a no-op if unmounted
      context.actions.produce((draft) => {
        draft.model.slowOpStatus = "completed";
      });
      onLog("completed");
    } catch {
      onLog("aborted");
    }
  });

  // Rule 22: Abort running tasks on unmount to properly cancel them
  // Without this, tasks continue running but can't update state
  actions.useAction(Lifecycle.Unmount, (context) => {
    for (const task of context.tasks) {
      if (task.action === TaskActions.SlowOperation) {
        task.controller.abort();
      }
    }
  });

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 20 Test: Abort signal for cancellation
 */
function Rule20AbortSignal() {
  const [model, actions] = useRule20Actions();

  return (
    <section data-testid="rule-20">
      <h3>Rule 20: Abort Signal</h3>
      <div data-testid="rule-20-status">{model.fetchStatus}</div>
      <div data-testid="rule-20-result">{model.fetchResult}</div>
      <div data-testid="rule-20-cancelled">
        {model.cancelled ? "cancelled" : "not-cancelled"}
      </div>
      <button
        data-testid="rule-20-fetch"
        onClick={() =>
          actions.dispatch(TaskActions.FetchWithSignal, "/api/data")
        }
      >
        Start Fetch
      </button>
      <button
        data-testid="rule-20-cancel"
        onClick={() => actions.dispatch(TaskActions.CancelOthers)}
      >
        Cancel Fetch
      </button>
    </section>
  );
}

/**
 * Rule 21 Test: Cancel competing tasks explicitly
 */
function Rule21CompetingTasks() {
  const [model, actions] = useRule21Actions();

  return (
    <section data-testid="rule-21">
      <h3>Rule 21: Cancel Competing Tasks</h3>
      <div data-testid="rule-21-results">
        {model.competingResults.join(", ")}
      </div>
      <div data-testid="rule-21-task-count">{model.activeTaskCount}</div>
      <button
        data-testid="rule-21-fetch-1"
        onClick={() => actions.dispatch(TaskActions.CompetingFetch, 1)}
      >
        Fetch 1
      </button>
      <button
        data-testid="rule-21-fetch-2"
        onClick={() => actions.dispatch(TaskActions.CompetingFetch, 2)}
      >
        Fetch 2
      </button>
      <button
        data-testid="rule-21-fetch-3"
        onClick={() => actions.dispatch(TaskActions.CompetingFetch, 3)}
      >
        Fetch 3
      </button>
      <button
        data-testid="rule-21-rapid"
        onClick={() => {
          actions.dispatch(TaskActions.CompetingFetch, 1);
          setTimeout(
            () => actions.dispatch(TaskActions.CompetingFetch, 2),
            100,
          );
          setTimeout(
            () => actions.dispatch(TaskActions.CompetingFetch, 3),
            200,
          );
        }}
      >
        Rapid Fire (1,2,3)
      </button>
      <button
        data-testid="rule-21-get-count"
        onClick={() => actions.dispatch(TaskActions.GetTaskCount)}
      >
        Get Task Count
      </button>
    </section>
  );
}

/**
 * Rule 22 Test: State updates blocked after unmount
 * Child component that tries to update state after unmount
 */
function UnmountableChild({ onLog }: { onLog: (msg: string) => void }) {
  const [model, actions] = useUnmountableChildActions(onLog);

  return (
    <div data-testid="rule-22-child">
      <div data-testid="rule-22-child-status">{model.slowOpStatus}</div>
      <button
        data-testid="rule-22-start-slow"
        onClick={() => actions.dispatch(TaskActions.SlowOperation)}
      >
        Start Slow Op
      </button>
    </div>
  );
}

function Rule22UnmountBlocking() {
  const [showChild, setShowChild] = React.useState(true);
  const [logs, setLogs] = React.useState<string[]>([]);

  const handleLog = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
  };

  return (
    <section data-testid="rule-22">
      <h3>Rule 22: Blocked Updates After Unmount</h3>
      {showChild && <UnmountableChild onLog={handleLog} />}
      <div data-testid="rule-22-logs">{logs.join(", ")}</div>
      <div data-testid="rule-22-mounted">
        {showChild ? "mounted" : "unmounted"}
      </div>
      <button data-testid="rule-22-unmount" onClick={() => setShowChild(false)}>
        Unmount Child
      </button>
      <button
        data-testid="rule-22-mount"
        onClick={() => {
          setShowChild(true);
          setLogs([]);
        }}
      >
        Mount Child
      </button>
      <button data-testid="rule-22-clear-logs" onClick={() => setLogs([])}>
        Clear Logs
      </button>
    </section>
  );
}

export function TaskManagementFixture() {
  return (
    <div data-testid="task-management-fixture">
      <h2>Rules 20-22: Task Management</h2>
      <Rule20AbortSignal />
      <Rule21CompetingTasks />
      <Rule22UnmountBlocking />
    </div>
  );
}
