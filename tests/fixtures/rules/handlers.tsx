/**
 * E2E Test Fixtures for Rules 8-12: Handlers
 *
 * Rule 8: Four handler signatures (sync, async, finite generator, infinite generator)
 * Rule 9: Use With() for simple property assignments
 * Rule 10: Use filtered actions for targeted event delivery
 * Rule 11: Extract handlers for testability using Handler type
 * Rule 12: Access external values via context.data after await
 */
import * as React from "react";
import {
  Action,
  Distribution,
  useActions,
  With,
  utils,
} from "../../../src/library/index.ts";

// Actions for handler signature tests
class HandlerActions {
  static SyncAction = Action<string>("SyncAction");
  static AsyncAction = Action<string>("AsyncAction");
  static GeneratorAction = Action<string[]>("GeneratorAction");
  static InfiniteGeneratorAction = Action("InfiniteGeneratorAction");
  static StopPolling = Action("StopPolling");
}

// Actions for With() helper
class WithActions {
  static SetName = Action<string>("SetName");
  static SetAge = Action<number>("SetAge");
  static SetActive = Action<boolean>("SetActive");
}

// Actions for filtered delivery
class FilteredActions {
  static UserUpdated = Action<{ id: number; name: string }>(
    "UserUpdated",
    Distribution.Broadcast,
  );
}

// Actions for context.data test
class DataActions {
  static FetchWithData = Action("FetchWithData");
}

type HandlerModel = {
  syncResult: string;
  asyncResult: string;
  generatorResults: string[];
  pollCount: number;
  isPolling: boolean;
};

type WithModel = {
  name: string;
  age: number;
  active: boolean;
};

type FilteredModel = {
  user1Name: string;
  user2Name: string;
  allUsersUpdates: number;
};

type DataModel = {
  capturedQuery: string;
  fetchResult: string;
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useRule8Actions() {
  const actions = useActions<HandlerModel, typeof HandlerActions>({
    syncResult: "",
    asyncResult: "",
    generatorResults: [],
    pollCount: 0,
    isPolling: false,
  });

  // Synchronous handler
  actions.useAction(HandlerActions.SyncAction, (context, value) => {
    context.actions.produce((draft) => {
      draft.model.syncResult = `sync: ${value}`;
    });
  });

  // Asynchronous handler
  actions.useAction(HandlerActions.AsyncAction, async (context, value) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    context.actions.produce((draft) => {
      draft.model.asyncResult = `async: ${value}`;
    });
  });

  // Finite generator handler
  actions.useAction(HandlerActions.GeneratorAction, function* (context, items) {
    context.actions.produce((draft) => {
      draft.model.generatorResults = [];
    });
    for (const item of items) {
      yield; // Process one at a time
      context.actions.produce((draft) => {
        draft.model.generatorResults = [...draft.model.generatorResults, item];
      });
    }
  });

  // Infinite generator handler (polling pattern)
  actions.useAction(
    HandlerActions.InfiniteGeneratorAction,
    function* (context) {
      const { signal } = context.task.controller;
      context.actions.produce((draft) => {
        draft.model.isPolling = true;
        draft.model.pollCount = 0;
      });

      while (!signal.aborted) {
        yield utils.sleep(300, signal);
        if (signal.aborted) break;
        context.actions.produce((draft) => {
          draft.model.pollCount += 1;
        });
      }

      context.actions.produce((draft) => {
        draft.model.isPolling = false;
      });
    },
  );

  // Stop polling by aborting
  actions.useAction(HandlerActions.StopPolling, (context) => {
    for (const task of context.tasks) {
      if (task.action === HandlerActions.InfiniteGeneratorAction) {
        task.controller.abort();
      }
    }
    // Immediately update state
    context.actions.produce((draft) => {
      draft.model.isPolling = false;
    });
  });

  return actions;
}

function useRule9Actions() {
  const actions = useActions<WithModel, typeof WithActions>({
    name: "",
    age: 0,
    active: false,
  });

  // Using With() for simple property assignments
  actions.useAction(WithActions.SetName, With("name"));
  actions.useAction(WithActions.SetAge, With("age"));
  actions.useAction(WithActions.SetActive, With("active"));

  return actions;
}

function useRule10Actions() {
  const actions = useActions<FilteredModel, typeof FilteredActions>({
    user1Name: "",
    user2Name: "",
    allUsersUpdates: 0,
  });

  // Handler for user 1 only
  actions.useAction(
    [FilteredActions.UserUpdated, { UserId: 1 }],
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user1Name = user.name;
      });
    },
  );

  // Handler for user 2 only
  actions.useAction(
    [FilteredActions.UserUpdated, { UserId: 2 }],
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user2Name = user.name;
      });
    },
  );

  // Handler for ALL UserUpdated dispatches (plain action)
  actions.useAction(FilteredActions.UserUpdated, (context) => {
    context.actions.produce((draft) => {
      draft.model.allUsersUpdates += 1;
    });
  });

  return actions;
}

function useRule12Actions(query: string) {
  const actions = useActions<DataModel, typeof DataActions, { query: string }>(
    {
      capturedQuery: "",
      fetchResult: "",
    },
    () => ({ query }),
  );

  actions.useAction(DataActions.FetchWithData, async (context) => {
    // Capture query at dispatch time (this would be stale after await)
    const queryAtDispatch = context.data.query;

    context.actions.produce((draft) => {
      draft.model.fetchResult = "loading";
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // context.data.query is always the LATEST value
    context.actions.produce((draft) => {
      draft.model.capturedQuery = context.data.query;
      draft.model.fetchResult = `done (dispatched with: ${queryAtDispatch})`;
    });
  });

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 8 Test: Four handler signatures
 */
function Rule8HandlerSignatures() {
  const [model, actions] = useRule8Actions();

  return (
    <section data-testid="rule-8">
      <h3>Rule 8: Handler Signatures</h3>
      <div data-testid="rule-8-sync">{model.syncResult}</div>
      <div data-testid="rule-8-async">{model.asyncResult}</div>
      <div data-testid="rule-8-generator">
        {model.generatorResults.join(", ")}
      </div>
      <div data-testid="rule-8-poll-count">{model.pollCount}</div>
      <div data-testid="rule-8-is-polling">
        {model.isPolling ? "polling" : "stopped"}
      </div>
      <button
        data-testid="rule-8-sync-btn"
        onClick={() => actions.dispatch(HandlerActions.SyncAction, "hello")}
      >
        Sync
      </button>
      <button
        data-testid="rule-8-async-btn"
        onClick={() => actions.dispatch(HandlerActions.AsyncAction, "world")}
      >
        Async
      </button>
      <button
        data-testid="rule-8-generator-btn"
        onClick={() =>
          actions.dispatch(HandlerActions.GeneratorAction, ["a", "b", "c"])
        }
      >
        Generator
      </button>
      <button
        data-testid="rule-8-poll-start"
        onClick={() => actions.dispatch(HandlerActions.InfiniteGeneratorAction)}
      >
        Start Polling
      </button>
      <button
        data-testid="rule-8-poll-stop"
        onClick={() => actions.dispatch(HandlerActions.StopPolling)}
      >
        Stop Polling
      </button>
    </section>
  );
}

/**
 * Rule 9 Test: With() helper for simple assignments
 */
function Rule9WithHelper() {
  const [model, actions] = useRule9Actions();

  return (
    <section data-testid="rule-9">
      <h3>Rule 9: With() Helper</h3>
      <div data-testid="rule-9-name">{model.name}</div>
      <div data-testid="rule-9-age">{model.age}</div>
      <div data-testid="rule-9-active">
        {model.active ? "active" : "inactive"}
      </div>
      <button
        data-testid="rule-9-set-name"
        onClick={() => actions.dispatch(WithActions.SetName, "Alice")}
      >
        Set Name
      </button>
      <button
        data-testid="rule-9-set-age"
        onClick={() => actions.dispatch(WithActions.SetAge, 30)}
      >
        Set Age
      </button>
      <button
        data-testid="rule-9-set-active"
        onClick={() => actions.dispatch(WithActions.SetActive, true)}
      >
        Set Active
      </button>
    </section>
  );
}

/**
 * Rule 10 Test: Filtered actions for targeted delivery
 */
function Rule10FilteredActions() {
  const [model, actions] = useRule10Actions();

  return (
    <section data-testid="rule-10">
      <h3>Rule 10: Filtered Actions</h3>
      <div data-testid="rule-10-user1">{model.user1Name}</div>
      <div data-testid="rule-10-user2">{model.user2Name}</div>
      <div data-testid="rule-10-all-updates">{model.allUsersUpdates}</div>
      <button
        data-testid="rule-10-update-user1"
        onClick={() =>
          actions.dispatch([FilteredActions.UserUpdated, { UserId: 1 }], {
            id: 1,
            name: "Alice",
          })
        }
      >
        Update User 1
      </button>
      <button
        data-testid="rule-10-update-user2"
        onClick={() =>
          actions.dispatch([FilteredActions.UserUpdated, { UserId: 2 }], {
            id: 2,
            name: "Bob",
          })
        }
      >
        Update User 2
      </button>
      <button
        data-testid="rule-10-update-all"
        onClick={() =>
          actions.dispatch(FilteredActions.UserUpdated, {
            id: 3,
            name: "Charlie",
          })
        }
      >
        Update All (Plain)
      </button>
    </section>
  );
}

/**
 * Rule 12 Test: Access external values via context.data after await
 */
function Rule12ContextData() {
  const [query, setQuery] = React.useState("initial-query");
  const [model, actions] = useRule12Actions(query);

  return (
    <section data-testid="rule-12">
      <h3>Rule 12: context.data Access</h3>
      <div data-testid="rule-12-current-query">{query}</div>
      <div data-testid="rule-12-captured">{model.capturedQuery}</div>
      <div data-testid="rule-12-result">{model.fetchResult}</div>
      <input
        data-testid="rule-12-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        data-testid="rule-12-fetch"
        onClick={() => actions.dispatch(DataActions.FetchWithData)}
      >
        Fetch
      </button>
    </section>
  );
}

export function HandlersFixture() {
  return (
    <div data-testid="handlers-fixture">
      <h2>Rules 8-12: Handlers</h2>
      <Rule8HandlerSignatures />
      <Rule9WithHelper />
      <Rule10FilteredActions />
      {/* Rule 11 is about code organization (Handler type) - tested via type checking */}
      <section data-testid="rule-11">
        <h3>Rule 11: Handler Type</h3>
        <p>
          Rule 11 is about using the Handler type for testability. This is a
          compile-time feature verified by TypeScript, not a runtime behavior.
        </p>
      </section>
      <Rule12ContextData />
    </div>
  );
}
