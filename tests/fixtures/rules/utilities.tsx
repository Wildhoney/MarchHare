/**
 * E2E Test Fixtures for Rules 36-39: Utilities
 *
 * Rule 36: Use utils.sleep() for delays with cancellation support
 * Rule 37: Use utils.pk() for optimistic update keys
 * Rule 38: Prefer ky over React Query for HTTP requests (conceptual - uses fetch)
 * Rule 39: Use distributed actions for SSE (Server-Sent Events)
 */
import * as React from "react";
import {
  Action,
  Distribution,
  useActions,
  utils,
  type Pk,
} from "../../../src/library/index.ts";

class UtilityActions {
  static SleepTest = Action<number>("SleepTest");
  static CancelSleep = Action("CancelSleep");
  static AddOptimistic = Action<string>("AddOptimistic");
  static ConfirmItem = Action<{ tempId: symbol; realId: number }>(
    "ConfirmItem",
  );
  static FetchData = Action("FetchData");
  static StartSSE = Action("StartSSE");
  static StopSSE = Action("StopSSE");
  // SSE message action - broadcast to all listeners
  static SSEMessage = Action<{ type: string; data: string }>(
    "SSEMessage",
    Distribution.Broadcast,
  );
}

type Item = {
  id: Pk<number>;
  name: string;
  confirmed: boolean;
};

type UtilityModel = {
  sleepResult: string;
  sleepStatus: string;
  items: Item[];
  fetchResult: string;
  fetchStatus: string;
  sseMessages: string[];
  sseConnected: boolean;
};

/**
 * Custom hook for Rule 36: utils.sleep() with cancellation
 */
function useRule36Actions() {
  const actions = useActions<UtilityModel, typeof UtilityActions>({
    sleepResult: "",
    sleepStatus: "idle",
    items: [],
    fetchResult: "",
    fetchStatus: "idle",
    sseMessages: [],
    sseConnected: false,
  });

  actions.useAction(UtilityActions.SleepTest, async (context, duration) => {
    const { signal } = context.task.controller;

    context.actions.produce((draft) => {
      draft.model.sleepStatus = "sleeping";
      draft.model.sleepResult = "";
    });

    try {
      // Rule 36: utils.sleep with abort signal
      await utils.sleep(duration, signal);

      context.actions.produce((draft) => {
        draft.model.sleepStatus = "complete";
        draft.model.sleepResult = `Slept for ${duration}ms`;
      });
    } catch {
      context.actions.produce((draft) => {
        draft.model.sleepStatus = "cancelled";
        draft.model.sleepResult = "Sleep was cancelled";
      });
    }
  });

  actions.useAction(UtilityActions.CancelSleep, (context) => {
    for (const task of context.tasks) {
      if (task.action === UtilityActions.SleepTest) {
        task.controller.abort();
      }
    }
    // Immediately update state since the aborted task's produce() may be blocked
    context.actions.produce((draft) => {
      draft.model.sleepStatus = "cancelled";
      draft.model.sleepResult = "Sleep was cancelled";
    });
  });

  return actions;
}

/**
 * Rule 36 Test: utils.sleep() with cancellation
 */
function Rule36Sleep() {
  const [model, actions] = useRule36Actions();

  return (
    <section data-testid="rule-36">
      <h3>Rule 36: utils.sleep()</h3>
      <div data-testid="rule-36-status">{model.sleepStatus}</div>
      <div data-testid="rule-36-result">{model.sleepResult}</div>
      <button
        data-testid="rule-36-sleep-1s"
        onClick={() => actions.dispatch(UtilityActions.SleepTest, 1000)}
      >
        Sleep 1s
      </button>
      <button
        data-testid="rule-36-sleep-3s"
        onClick={() => actions.dispatch(UtilityActions.SleepTest, 3000)}
      >
        Sleep 3s
      </button>
      <button
        data-testid="rule-36-cancel"
        onClick={() => actions.dispatch(UtilityActions.CancelSleep)}
      >
        Cancel Sleep
      </button>
    </section>
  );
}

/**
 * Custom hook for Rule 37: utils.pk() for optimistic keys
 */
function useRule37Actions() {
  const actions = useActions<UtilityModel, typeof UtilityActions>({
    sleepResult: "",
    sleepStatus: "idle",
    items: [],
    fetchResult: "",
    fetchStatus: "idle",
    sseMessages: [],
    sseConnected: false,
  });

  actions.useAction(UtilityActions.AddOptimistic, async (context, name) => {
    // Rule 37: utils.pk() generates a symbol for temporary keys
    const tempId = utils.pk();

    // Optimistically add item with temp id
    context.actions.produce((draft) => {
      draft.model.items.push({ id: tempId, name, confirmed: false });
    });

    // Simulate API confirmation
    await utils.sleep(800, context.task.controller.signal);

    // Replace temp id with real id
    const realId = Math.floor(Math.random() * 10000);
    context.actions.produce((draft) => {
      const item = draft.model.items.find((i) => i.id === tempId);
      if (item) {
        item.id = realId;
        item.confirmed = true;
      }
    });
  });

  return actions;
}

/**
 * Rule 37 Test: utils.pk() for optimistic keys
 */
function Rule37PrimaryKeys() {
  const [model, actions] = useRule37Actions();

  return (
    <section data-testid="rule-37">
      <h3>Rule 37: utils.pk()</h3>
      <div data-testid="rule-37-count">{model.items.length}</div>
      <div data-testid="rule-37-items">
        {model.items.map((item, i) => (
          <div key={String(item.id)} data-testid={`rule-37-item-${i}`}>
            <span data-testid={`rule-37-item-${i}-name`}>{item.name}</span>
            <span data-testid={`rule-37-item-${i}-type`}>
              {typeof item.id === "symbol" ? "temp" : "confirmed"}
            </span>
            <span data-testid={`rule-37-item-${i}-id`}>
              {typeof item.id === "symbol" ? "symbol" : item.id}
            </span>
          </div>
        ))}
      </div>
      <button
        data-testid="rule-37-add"
        onClick={() =>
          actions.dispatch(UtilityActions.AddOptimistic, "New Item")
        }
      >
        Add Item
      </button>
      <button
        data-testid="rule-37-add-multiple"
        onClick={() => {
          actions.dispatch(UtilityActions.AddOptimistic, "Item A");
          actions.dispatch(UtilityActions.AddOptimistic, "Item B");
          actions.dispatch(UtilityActions.AddOptimistic, "Item C");
        }}
      >
        Add Multiple
      </button>
    </section>
  );
}

/**
 * Custom hook for Rule 38: HTTP requests with cancellation
 */
function useRule38Actions() {
  const actions = useActions<UtilityModel, typeof UtilityActions>({
    sleepResult: "",
    sleepStatus: "idle",
    items: [],
    fetchResult: "",
    fetchStatus: "idle",
    sseMessages: [],
    sseConnected: false,
  });

  actions.useAction(UtilityActions.FetchData, async (context) => {
    const { signal } = context.task.controller;

    context.actions.produce((draft) => {
      draft.model.fetchStatus = "loading";
    });

    try {
      // Rule 38: Pass abort signal to HTTP requests
      // In real usage: await ky.get('/api/data', { signal }).json()
      await utils.sleep(800, signal);

      // Simulated successful response
      context.actions.produce((draft) => {
        draft.model.fetchStatus = "success";
        draft.model.fetchResult = JSON.stringify({
          data: ["item1", "item2", "item3"],
          timestamp: Date.now(),
        });
      });
    } catch {
      context.actions.produce((draft) => {
        draft.model.fetchStatus = "cancelled";
        draft.model.fetchResult = "Request cancelled";
      });
    }
  });

  return actions;
}

/**
 * Rule 38 Test: HTTP requests with cancellation
 * (Demonstrates the pattern - uses simulated fetch instead of actual ky)
 */
function Rule38HttpRequests() {
  const [model, actions] = useRule38Actions();

  return (
    <section data-testid="rule-38">
      <h3>Rule 38: HTTP Requests Pattern</h3>
      <div data-testid="rule-38-status">{model.fetchStatus}</div>
      <div data-testid="rule-38-result">{model.fetchResult}</div>
      <button
        data-testid="rule-38-fetch"
        onClick={() => actions.dispatch(UtilityActions.FetchData)}
      >
        Fetch Data
      </button>
      <p>
        <small>
          Demonstrates passing abort signal to HTTP requests. In production, use
          ky: <code>await ky.get('/api', &#123; signal &#125;).json()</code>
        </small>
      </p>
    </section>
  );
}

/**
 * Custom hook for Rule 39: SSE with distributed actions
 */
function useRule39Actions() {
  const actions = useActions<UtilityModel, typeof UtilityActions>({
    sleepResult: "",
    sleepStatus: "idle",
    items: [],
    fetchResult: "",
    fetchStatus: "idle",
    sseMessages: [],
    sseConnected: false,
  });

  // SSE connection handler
  actions.useAction(UtilityActions.StartSSE, function* (context) {
    const { signal } = context.task.controller;

    context.actions.produce((draft) => {
      draft.model.sseConnected = true;
      draft.model.sseMessages = [];
    });

    // Simulate SSE messages every second
    let messageCount = 0;
    while (!signal.aborted) {
      yield utils.sleep(1000, signal);
      if (signal.aborted) break;

      messageCount++;
      // Rule 39: Dispatch broadcast action for SSE message
      context.actions.dispatch(UtilityActions.SSEMessage, {
        type: "update",
        data: `Message ${messageCount}`,
      });
    }

    context.actions.produce((draft) => {
      draft.model.sseConnected = false;
    });
  });

  // Listen for SSE messages
  actions.useAction(UtilityActions.SSEMessage, (context, message) => {
    context.actions.produce((draft) => {
      draft.model.sseMessages = [
        ...draft.model.sseMessages,
        `${message.type}: ${message.data}`,
      ];
    });
  });

  // Stop SSE
  actions.useAction(UtilityActions.StopSSE, (context) => {
    for (const task of context.tasks) {
      if (task.action === UtilityActions.StartSSE) {
        task.controller.abort();
      }
    }
    // Immediately set disconnected state
    context.actions.produce((draft) => {
      draft.model.sseConnected = false;
    });
  });

  return actions;
}

/**
 * Rule 39 Test: SSE with distributed actions
 * (Simulates SSE behaviour without actual EventSource)
 */
function Rule39SSE() {
  const [model, actions] = useRule39Actions();

  return (
    <section data-testid="rule-39">
      <h3>Rule 39: SSE with Distributed Actions</h3>
      <div data-testid="rule-39-connected">
        {model.sseConnected ? "connected" : "disconnected"}
      </div>
      <div data-testid="rule-39-message-count">{model.sseMessages.length}</div>
      <div data-testid="rule-39-messages">{model.sseMessages.join(" | ")}</div>
      <button
        data-testid="rule-39-start"
        onClick={() => actions.dispatch(UtilityActions.StartSSE)}
      >
        Start SSE
      </button>
      <button
        data-testid="rule-39-stop"
        onClick={() => actions.dispatch(UtilityActions.StopSSE)}
      >
        Stop SSE
      </button>
    </section>
  );
}

/**
 * Custom hook for SSE subscriber
 */
function useSSESubscriberActions() {
  const actions = useActions<{}, typeof UtilityActions>({});
  return actions;
}

/**
 * SSE Subscriber - demonstrates late-mounting components receiving SSE broadcasts
 */
function SSESubscriber({ id }: { id: string }) {
  const [messages, setMessages] = React.useState<string[]>([]);
  const actions = useSSESubscriberActions();

  actions.useAction(UtilityActions.SSEMessage, (context, message) => {
    setMessages((prev) => [...prev, `${message.type}: ${message.data}`]);
  });

  return (
    <div data-testid={`rule-39-subscriber-${id}`}>
      <div data-testid={`rule-39-subscriber-${id}-count`}>
        {messages.length}
      </div>
      <div data-testid={`rule-39-subscriber-${id}-messages`}>
        {messages.join(" | ")}
      </div>
    </div>
  );
}

function Rule39WithSubscribers() {
  const [showSubscriber, setShowSubscriber] = React.useState(false);

  return (
    <section data-testid="rule-39-subscribers">
      <h3>Rule 39: SSE Subscribers</h3>
      <Rule39SSE />
      {showSubscriber && <SSESubscriber id="late" />}
      <button
        data-testid="rule-39-mount-subscriber"
        onClick={() => setShowSubscriber(true)}
      >
        Mount Late Subscriber
      </button>
      <button
        data-testid="rule-39-unmount-subscriber"
        onClick={() => setShowSubscriber(false)}
      >
        Unmount Subscriber
      </button>
    </section>
  );
}

export function UtilitiesFixture() {
  return (
    <div data-testid="utilities-fixture">
      <h2>Rules 36-39: Utilities</h2>
      <Rule36Sleep />
      <Rule37PrimaryKeys />
      <Rule38HttpRequests />
      <Rule39WithSubscribers />
    </div>
  );
}
