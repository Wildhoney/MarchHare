/**
 * E2E Test Fixtures for Rules 23-26: Error Handling
 *
 * Rule 23: Use Lifecycle.Error for local error recovery
 * Rule 24: Use the <Error> boundary for global error handling
 * Rule 25: Know the error reasons (Timedout, Supplanted, Disallowed, Errored, Unmounted)
 * Rule 26: Use Option or Result for fallible model properties
 */
import * as React from "react";
import {
  Action,
  useActions,
  Lifecycle,
  Error as ErrorBoundary,
  Reason,
  utils,
} from "../../../src/library/index.ts";
import { O, R } from "@mobily/ts-belt";

class ErrorActions {
  static Error = Lifecycle.Error();
  static ThrowError = Action<string>("ThrowError");
  static ThrowTimeout = Action("ThrowTimeout");
  static SupplantAction = Action<number>("SupplantAction");
  static RecoverableAction = Action("RecoverableAction");
  static ClearError = Action("ClearError");
}

class OptionResultActions {
  static FetchUser = Action<boolean>("FetchUser"); // true = success, false = fail
  static FetchData = Action<boolean>("FetchData");
}

type ErrorModel = {
  lastError: string;
  lastReason: string;
  lastAction: string;
  recoveryAttempts: number;
  supplantResults: string[];
};

type OptionModel = {
  user: O.Option<{ name: string; email: string }>;
  data: R.Result<string[], string>; // Use string for error message (Immer-friendly)
  loadingUser: boolean;
  loadingData: boolean;
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useRule23Actions() {
  const actions = useActions<ErrorModel, typeof ErrorActions>({
    lastError: "",
    lastReason: "",
    lastAction: "",
    recoveryAttempts: 0,
    supplantResults: [],
  });

  actions.useAction(ErrorActions.ThrowError, (context, message) => {
    throw new Error(message);
  });

  actions.useAction(ErrorActions.RecoverableAction, async (context) => {
    // Simulate recoverable error
    await utils.sleep(100);
    throw new Error("Recoverable failure");
  });

  actions.useAction(ErrorActions.ClearError, (context) => {
    context.actions.produce((draft) => {
      draft.model.lastError = "";
      draft.model.lastReason = "";
      draft.model.lastAction = "";
    });
  });

  // Local error handler
  actions.useAction(ErrorActions.Error, (context, fault) => {
    context.actions.produce((draft) => {
      draft.model.lastError = fault.error.message;
      draft.model.lastReason = Reason[fault.reason]?.toLowerCase() ?? "";
      draft.model.lastAction = fault.action ?? "unknown";
      draft.model.recoveryAttempts += 1;
    });
  });

  return actions;
}

function useRule24ChildActions() {
  const actions = useActions<{}, typeof ErrorActions>({});

  // No local error handler - errors propagate to boundary
  actions.useAction(ErrorActions.ThrowError, (context, message) => {
    throw new Error(message);
  });

  return actions;
}

function useRule25Actions() {
  const actions = useActions<ErrorModel, typeof ErrorActions>({
    lastError: "",
    lastReason: "",
    lastAction: "",
    recoveryAttempts: 0,
    supplantResults: [],
  });

  // Action that throws (Reason.Errored)
  actions.useAction(ErrorActions.ThrowError, () => {
    throw new Error("Intentional error");
  });

  // Action for supplant test
  actions.useAction(ErrorActions.SupplantAction, async (context, id) => {
    // Cancel previous instances of this action
    for (const task of context.tasks) {
      if (
        task !== context.task &&
        task.action === ErrorActions.SupplantAction
      ) {
        task.controller.abort();
      }
    }

    await utils.sleep(500, context.task.controller.signal);

    context.actions.produce((draft) => {
      draft.model.supplantResults = [
        ...draft.model.supplantResults,
        `done:${id}`,
      ];
    });
  });

  actions.useAction(ErrorActions.Error, (context, fault) => {
    context.actions.produce((draft) => {
      draft.model.lastReason = Reason[fault.reason]?.toLowerCase() ?? "";
      draft.model.lastError = fault.error.message;
      draft.model.lastAction = fault.action ?? "";
    });
  });

  return actions;
}

function useRule26Actions() {
  const actions = useActions<OptionModel, typeof OptionResultActions>({
    user: O.None,
    data: R.Error("Not loaded"),
    loadingUser: false,
    loadingData: false,
  });

  // Fetch user with Option<T>
  actions.useAction(
    OptionResultActions.FetchUser,
    async (context, shouldSucceed) => {
      context.actions.produce((draft) => {
        draft.model.loadingUser = true;
      });

      await utils.sleep(300);

      context.actions.produce((draft) => {
        draft.model.loadingUser = false;
        if (shouldSucceed) {
          draft.model.user = O.Some({
            name: "Alice",
            email: "alice@example.com",
          });
        } else {
          draft.model.user = O.None;
        }
      });
    },
  );

  // Fetch data with Result<T, E>
  actions.useAction(
    OptionResultActions.FetchData,
    async (context, shouldSucceed) => {
      context.actions.produce((draft) => {
        draft.model.loadingData = true;
      });

      await utils.sleep(300);

      context.actions.produce((draft) => {
        draft.model.loadingData = false;
        if (shouldSucceed) {
          draft.model.data = R.Ok(["item1", "item2", "item3"]);
        } else {
          draft.model.data = R.Error("Failed to fetch data");
        }
      });
    },
  );

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 23 Test: Lifecycle.Error for local error recovery
 */
function Rule23LocalErrorRecovery() {
  const [model, actions] = useRule23Actions();

  return (
    <section data-testid="rule-23">
      <h3>Rule 23: Local Error Recovery</h3>
      <div data-testid="rule-23-error">{model.lastError}</div>
      <div data-testid="rule-23-reason">{model.lastReason}</div>
      <div data-testid="rule-23-action">{model.lastAction}</div>
      <div data-testid="rule-23-attempts">{model.recoveryAttempts}</div>
      <button
        data-testid="rule-23-throw"
        onClick={() =>
          actions.dispatch(ErrorActions.ThrowError, "Test error message")
        }
      >
        Throw Error
      </button>
      <button
        data-testid="rule-23-recoverable"
        onClick={() => actions.dispatch(ErrorActions.RecoverableAction)}
      >
        Recoverable Action
      </button>
      <button
        data-testid="rule-23-clear"
        onClick={() => actions.dispatch(ErrorActions.ClearError)}
      >
        Clear
      </button>
    </section>
  );
}

/**
 * Rule 24 Test: <Error> boundary for global error handling
 * The parent fixture already wraps this in an <Error> boundary,
 * but we'll test a nested one here.
 */
function Rule24GlobalErrorBoundary() {
  const [globalErrors, setGlobalErrors] = React.useState<string[]>([]);

  return (
    <section data-testid="rule-24">
      <h3>Rule 24: Error Boundary</h3>
      <ErrorBoundary
        handler={({ reason, error, action }) => {
          setGlobalErrors((prev) => [
            ...prev,
            `${action}:${Reason[reason]?.toLowerCase()}:${error.message}`,
          ]);
        }}
      >
        <ErrorBoundaryChild />
      </ErrorBoundary>
      <div data-testid="rule-24-errors">{globalErrors.join(" | ")}</div>
      <button data-testid="rule-24-clear" onClick={() => setGlobalErrors([])}>
        Clear Errors
      </button>
    </section>
  );
}

function ErrorBoundaryChild() {
  const [, actions] = useRule24ChildActions();

  return (
    <div data-testid="rule-24-child">
      <button
        data-testid="rule-24-throw"
        onClick={() =>
          actions.dispatch(ErrorActions.ThrowError, "Boundary test")
        }
      >
        Throw to Boundary
      </button>
    </div>
  );
}

/**
 * Rule 25 Test: Error reasons
 */
function Rule25ErrorReasons() {
  const [model, actions] = useRule25Actions();

  return (
    <section data-testid="rule-25">
      <h3>Rule 25: Error Reasons</h3>
      <div data-testid="rule-25-reason">{model.lastReason}</div>
      <div data-testid="rule-25-error">{model.lastError}</div>
      <div data-testid="rule-25-supplant-results">
        {model.supplantResults.join(", ")}
      </div>

      {/* Reason.Errored */}
      <button
        data-testid="rule-25-errored"
        onClick={() => actions.dispatch(ErrorActions.ThrowError, "error")}
      >
        Reason.Errored
      </button>

      {/* Reason.Supplanted - rapid fire will cause earlier ones to be supplanted */}
      <button
        data-testid="rule-25-supplanted"
        onClick={() => {
          actions.dispatch(ErrorActions.SupplantAction, 1);
          setTimeout(
            () => actions.dispatch(ErrorActions.SupplantAction, 2),
            100,
          );
        }}
      >
        Reason.Supplanted
      </button>

      {/* Reference info */}
      <div data-testid="rule-25-info">
        <small>
          Reasons: Timedout={Reason.Timedout}, Supplanted={Reason.Supplanted},
          Errored={Reason.Errored}, Unmounted={Reason.Unmounted}
        </small>
      </div>
    </section>
  );
}

/**
 * Rule 26 Test: Option and Result for fallible properties
 */
function Rule26OptionResult() {
  const [model, actions] = useRule26Actions();

  // Render user with Option pattern matching
  const userDisplay = O.match(
    model.user,
    (user) => `${user.name} <${user.email}>`,
    () => "No user",
  );

  // Render data with Result pattern matching
  const dataDisplay = R.match(
    model.data,
    (items) => items.join(", "),
    (errorMsg) => `Error: ${errorMsg}`,
  );

  return (
    <section data-testid="rule-26">
      <h3>Rule 26: Option and Result</h3>

      {/* Option<User> */}
      <div data-testid="rule-26-user">{userDisplay}</div>
      <div data-testid="rule-26-user-loading">
        {model.loadingUser ? "loading" : "idle"}
      </div>
      <div data-testid="rule-26-user-some">
        {O.isSome(model.user) ? "some" : "none"}
      </div>
      <button
        data-testid="rule-26-fetch-user-success"
        onClick={() => actions.dispatch(OptionResultActions.FetchUser, true)}
      >
        Fetch User (Success)
      </button>
      <button
        data-testid="rule-26-fetch-user-fail"
        onClick={() => actions.dispatch(OptionResultActions.FetchUser, false)}
      >
        Fetch User (Fail)
      </button>

      {/* Result<string[], Error> */}
      <div data-testid="rule-26-data">{dataDisplay}</div>
      <div data-testid="rule-26-data-loading">
        {model.loadingData ? "loading" : "idle"}
      </div>
      <div data-testid="rule-26-data-ok">
        {R.isOk(model.data) ? "ok" : "error"}
      </div>
      <button
        data-testid="rule-26-fetch-data-success"
        onClick={() => actions.dispatch(OptionResultActions.FetchData, true)}
      >
        Fetch Data (Success)
      </button>
      <button
        data-testid="rule-26-fetch-data-fail"
        onClick={() => actions.dispatch(OptionResultActions.FetchData, false)}
      >
        Fetch Data (Fail)
      </button>
    </section>
  );
}

export function ErrorHandlingFixture() {
  return (
    <div data-testid="error-handling-fixture">
      <h2>Rules 23-26: Error Handling</h2>
      <Rule23LocalErrorRecovery />
      <Rule24GlobalErrorBoundary />
      <Rule25ErrorReasons />
      <Rule26OptionResult />
    </div>
  );
}
