/**
 * E2E Test Fixtures for Rules 1-4: Actions
 *
 * Rule 1: Define actions as static class members
 * Rule 2: Use Distribution.Broadcast for cross-component communication
 * Rule 3: Never mix unicast and broadcast in the same class without inheritance
 * Rule 4: Action names should be descriptive for error tracing
 */
import * as React from "react";
import {
  Action,
  Distribution,
  useActions,
  Lifecycle,
} from "../../../src/library/index.ts";

// Rule 1: Actions defined as static class members
class LocalActions {
  static Increment = Action<number>("Increment");
  static Decrement = Action<number>("Decrement");
  static Reset = Action("Reset"); // void payload
}

// Rule 2: Broadcast actions for cross-component communication
class BroadcastActions {
  static UserLoggedIn = Action<{ name: string; id: number }>(
    "UserLoggedIn",
    Distribution.Broadcast,
  );
  static GlobalMessage = Action<string>(
    "GlobalMessage",
    Distribution.Broadcast,
  );
}

// Rule 3: Proper inheritance for mixed action types
class MixedActions extends BroadcastActions {
  static LocalFetch = Action<string>("LocalFetch");
  static LocalUpdate = Action<{ value: number }>("LocalUpdate");
}

// Rule 4: Descriptive action names (these will appear in error.action)
class DescriptiveActions {
  static FetchUserProfile = Action<number>("FetchUserProfile");
  static UpdateCartQuantity = Action<{ itemId: number; quantity: number }>(
    "UpdateCartQuantity",
  );
  static ProcessPaymentTransaction = Action<{ amount: number }>(
    "ProcessPaymentTransaction",
  );
}

type CounterModel = {
  count: number;
  lastAction: string;
};

type BroadcastModel = {
  user: { name: string; id: number } | null;
  messages: string[];
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useLocalActionsHook() {
  const actions = useActions<CounterModel, typeof LocalActions>({
    count: 0,
    lastAction: "",
  });

  actions.useAction(LocalActions.Increment, (context, amount) => {
    context.actions.produce((draft) => {
      draft.model.count += amount;
      draft.model.lastAction = "increment";
    });
  });

  actions.useAction(LocalActions.Decrement, (context, amount) => {
    context.actions.produce((draft) => {
      draft.model.count -= amount;
      draft.model.lastAction = "decrement";
    });
  });

  actions.useAction(LocalActions.Reset, (context) => {
    context.actions.produce((draft) => {
      draft.model.count = 0;
      draft.model.lastAction = "reset";
    });
  });

  return actions;
}

function useBroadcastSenderHook() {
  const actions = useActions<BroadcastModel, typeof BroadcastActions>({
    user: null,
    messages: [],
  });

  return actions;
}

function useBroadcastReceiverHook() {
  const actions = useActions<BroadcastModel, typeof BroadcastActions>({
    user: null,
    messages: [],
  });

  actions.useAction(BroadcastActions.UserLoggedIn, (context, user) => {
    context.actions.produce((draft) => {
      draft.model.user = user;
    });
  });

  actions.useAction(BroadcastActions.GlobalMessage, (context, message) => {
    context.actions.produce((draft) => {
      draft.model.messages = [...draft.model.messages, message];
    });
  });

  return actions;
}

function useMixedActionsHook() {
  const actions = useActions<
    { local: string; broadcast: string },
    typeof MixedActions
  >({
    local: "",
    broadcast: "",
  });

  // Local action handler (unicast)
  actions.useAction(MixedActions.LocalFetch, (context, query) => {
    context.actions.produce((draft) => {
      draft.model.local = `Fetched: ${query}`;
    });
  });

  // Broadcast action handler (inherited)
  actions.useAction(MixedActions.GlobalMessage, (context, message) => {
    context.actions.produce((draft) => {
      draft.model.broadcast = message;
    });
  });

  return actions;
}

function useDescriptiveActionsHook() {
  const actions = useActions<
    { errorAction: string; status: string },
    typeof DescriptiveActions
  >({
    errorAction: "",
    status: "idle",
  });

  actions.useAction(DescriptiveActions.FetchUserProfile, (context, userId) => {
    context.actions.produce((draft) => {
      draft.model.status = `Fetching user ${userId}`;
    });
  });

  actions.useAction(
    DescriptiveActions.UpdateCartQuantity,
    (context, update) => {
      context.actions.produce((draft) => {
        draft.model.status = `Updated item ${update.itemId} to qty ${update.quantity}`;
      });
    },
  );

  actions.useAction(
    DescriptiveActions.ProcessPaymentTransaction,
    (context, payment) => {
      // This will throw an error - the action name should be in the error
      if (payment.amount < 0) {
        throw new Error("Invalid payment amount");
      }
      context.actions.produce((draft) => {
        draft.model.status = `Processed $${payment.amount}`;
      });
    },
  );

  actions.useAction(Lifecycle.Error, (context, fault) => {
    context.actions.produce((draft) => {
      draft.model.errorAction = fault.action ?? "unknown";
      draft.model.status = "error";
    });
  });

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 1 Test: Local actions as static class members
 */
function Rule1LocalActions() {
  const [model, actions] = useLocalActionsHook();

  return (
    <section data-testid="rule-1">
      <h3>Rule 1: Static Class Members</h3>
      <div data-testid="rule-1-count">{model.count}</div>
      <div data-testid="rule-1-last-action">{model.lastAction}</div>
      <button
        data-testid="rule-1-increment"
        onClick={() => actions.dispatch(LocalActions.Increment, 1)}
      >
        +1
      </button>
      <button
        data-testid="rule-1-increment-5"
        onClick={() => actions.dispatch(LocalActions.Increment, 5)}
      >
        +5
      </button>
      <button
        data-testid="rule-1-decrement"
        onClick={() => actions.dispatch(LocalActions.Decrement, 1)}
      >
        -1
      </button>
      <button
        data-testid="rule-1-reset"
        onClick={() => actions.dispatch(LocalActions.Reset)}
      >
        Reset
      </button>
    </section>
  );
}

/**
 * Rule 2 Test: Broadcast actions for cross-component communication
 * Component A dispatches, Component B receives
 */
function Rule2BroadcastSender() {
  const [, actions] = useBroadcastSenderHook();

  return (
    <div data-testid="rule-2-sender">
      <button
        data-testid="rule-2-login"
        onClick={() =>
          actions.dispatch(BroadcastActions.UserLoggedIn, {
            name: "Alice",
            id: 123,
          })
        }
      >
        Login Alice
      </button>
      <button
        data-testid="rule-2-message"
        onClick={() =>
          actions.dispatch(BroadcastActions.GlobalMessage, "Hello from sender!")
        }
      >
        Send Message
      </button>
    </div>
  );
}

function Rule2BroadcastReceiver() {
  const [model] = useBroadcastReceiverHook();

  return (
    <div data-testid="rule-2-receiver">
      <div data-testid="rule-2-user">
        {model.user ? `${model.user.name} (${model.user.id})` : "No user"}
      </div>
      <div data-testid="rule-2-messages">{model.messages.join(", ")}</div>
    </div>
  );
}

/**
 * Rule 3 Test: Inheritance for mixed unicast/broadcast
 */
function Rule3MixedActions() {
  const [model, actions] = useMixedActionsHook();

  return (
    <section data-testid="rule-3">
      <h3>Rule 3: Mixed Actions via Inheritance</h3>
      <div data-testid="rule-3-local">{model.local}</div>
      <div data-testid="rule-3-broadcast">{model.broadcast}</div>
      <button
        data-testid="rule-3-local-btn"
        onClick={() => actions.dispatch(MixedActions.LocalFetch, "test-query")}
      >
        Local Fetch
      </button>
      <button
        data-testid="rule-3-broadcast-btn"
        onClick={() =>
          actions.dispatch(MixedActions.GlobalMessage, "Broadcast message")
        }
      >
        Broadcast
      </button>
    </section>
  );
}

/**
 * Rule 4 Test: Descriptive action names for error tracing
 * Actions that throw errors should have their names captured
 */
function Rule4DescriptiveNames() {
  const [model, actions] = useDescriptiveActionsHook();

  return (
    <section data-testid="rule-4">
      <h3>Rule 4: Descriptive Action Names</h3>
      <div data-testid="rule-4-status">{model.status}</div>
      <div data-testid="rule-4-error-action">{model.errorAction}</div>
      <button
        data-testid="rule-4-fetch"
        onClick={() =>
          actions.dispatch(DescriptiveActions.FetchUserProfile, 42)
        }
      >
        Fetch User
      </button>
      <button
        data-testid="rule-4-cart"
        onClick={() =>
          actions.dispatch(DescriptiveActions.UpdateCartQuantity, {
            itemId: 1,
            quantity: 3,
          })
        }
      >
        Update Cart
      </button>
      <button
        data-testid="rule-4-error"
        onClick={() =>
          actions.dispatch(DescriptiveActions.ProcessPaymentTransaction, {
            amount: -50,
          })
        }
      >
        Trigger Error
      </button>
    </section>
  );
}

export function ActionsFixture() {
  return (
    <div data-testid="actions-fixture">
      <h2>Rules 1-4: Actions</h2>
      <Rule1LocalActions />
      <section data-testid="rule-2">
        <h3>Rule 2: Broadcast Actions</h3>
        <Rule2BroadcastSender />
        <Rule2BroadcastReceiver />
      </section>
      <Rule3MixedActions />
      <Rule4DescriptiveNames />
    </div>
  );
}
