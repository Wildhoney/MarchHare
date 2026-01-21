/**
 * E2E Test Fixtures for Rules 13-15: Lifecycles
 *
 * Rule 13: Use lifecycle actions instead of useEffect
 * Rule 14: Understand the Phase context
 * Rule 15: Mounting phase delivers cached and lifecycle actions
 */
import * as React from "react";
import {
  Action,
  Distribution,
  useActions,
  Lifecycle,
} from "../../../src/library/index.ts";

class LifecycleActions {
  static SetupComplete = Action("SetupComplete");
  static UserInteraction = Action<string>("UserInteraction");
}

class CachedActions {
  static CachedData = Action<{ value: string; timestamp: number }>(
    "CachedData",
    Distribution.Broadcast,
  );
}

type LifecycleModel = {
  mountTime: number;
  unmountTime: number;
  nodeCallCount: number;
  lastError: string;
  events: string[];
};

type PhaseModel = {
  phaseAtMount: string;
  phaseAtAction: string;
  interactions: string[];
};

type CacheModel = {
  receivedData: string;
  phaseWhenReceived: string;
  receiveCount: number;
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useRule13Actions() {
  const actions = useActions<LifecycleModel, typeof LifecycleActions>({
    mountTime: 0,
    unmountTime: 0,
    nodeCallCount: 0,
    lastError: "",
    events: [],
  });

  // Lifecycle.Mount - runs once on mount (like useLayoutEffect with [])
  actions.useAction(Lifecycle.Mount, (context) => {
    context.actions.produce((draft) => {
      draft.model.mountTime = Date.now();
      draft.model.events = [...draft.model.events, "mount"];
    });
  });

  // Lifecycle.Node - runs once on mount (like useEffect with [] deps)
  actions.useAction(Lifecycle.Node, (context) => {
    context.actions.produce((draft) => {
      draft.model.nodeCallCount += 1;
      draft.model.events = [...draft.model.events, "node"];
    });
  });

  // Lifecycle.Unmount - runs on unmount
  actions.useAction(Lifecycle.Unmount, (context) => {
    context.actions.produce((draft) => {
      draft.model.unmountTime = Date.now();
      draft.model.events = [...draft.model.events, "unmount"];
    });
  });

  // Lifecycle.Error - local error handling
  actions.useAction(Lifecycle.Error, (context, fault) => {
    context.actions.produce((draft) => {
      draft.model.lastError = fault.error.message;
      draft.model.events = [...draft.model.events, "error"];
    });
  });

  // An action that throws to test error lifecycle
  actions.useAction(LifecycleActions.UserInteraction, (context, value) => {
    if (value === "throw") {
      throw new Error("Test error from interaction");
    }
    context.actions.produce((draft) => {
      draft.model.events = [...draft.model.events, `interaction:${value}`];
    });
  });

  return actions;
}

function useRule14Actions() {
  const actions = useActions<PhaseModel, typeof LifecycleActions>({
    phaseAtMount: "",
    phaseAtAction: "",
    interactions: [],
  });

  actions.useAction(Lifecycle.Mount, (context) => {
    // During mount, context.phase should be "mounting"
    context.actions.produce((draft) => {
      draft.model.phaseAtMount = context.phase;
    });
  });

  actions.useAction(LifecycleActions.UserInteraction, (context, value) => {
    // After mount, context.phase should be "mounted"
    context.actions.produce((draft) => {
      draft.model.phaseAtAction = context.phase;
      draft.model.interactions = [
        ...draft.model.interactions,
        `${value}@${context.phase}`,
      ];
    });
  });

  return actions;
}

function useCacheSenderActions() {
  const actions = useActions<CacheModel, typeof CachedActions>({
    receivedData: "",
    phaseWhenReceived: "",
    receiveCount: 0,
  });

  return actions;
}

function useCacheReceiverActions() {
  const actions = useActions<CacheModel, typeof CachedActions>({
    receivedData: "",
    phaseWhenReceived: "",
    receiveCount: 0,
  });

  actions.useAction(CachedActions.CachedData, (context, data) => {
    context.actions.produce((draft) => {
      draft.model.receivedData = data.value;
      draft.model.phaseWhenReceived = context.phase;
      draft.model.receiveCount += 1;
    });
  });

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 13 Test: Lifecycle actions instead of useEffect
 */
function Rule13LifecycleActions() {
  const [model, actions] = useRule13Actions();

  return (
    <section data-testid="rule-13">
      <h3>Rule 13: Lifecycle Actions</h3>
      <div data-testid="rule-13-mount-time">{model.mountTime}</div>
      <div data-testid="rule-13-node-count">{model.nodeCallCount}</div>
      <div data-testid="rule-13-last-error">{model.lastError}</div>
      <div data-testid="rule-13-events">{model.events.join(", ")}</div>
      <button
        data-testid="rule-13-interact"
        onClick={() =>
          actions.dispatch(LifecycleActions.UserInteraction, "click")
        }
      >
        Interact
      </button>
      <button
        data-testid="rule-13-throw"
        onClick={() =>
          actions.dispatch(LifecycleActions.UserInteraction, "throw")
        }
      >
        Throw Error
      </button>
    </section>
  );
}

/**
 * Rule 14 Test: Phase context understanding
 */
function Rule14PhaseContext() {
  const [model, actions] = useRule14Actions();

  return (
    <section data-testid="rule-14">
      <h3>Rule 14: Phase Context</h3>
      <div data-testid="rule-14-phase-mount">{model.phaseAtMount}</div>
      <div data-testid="rule-14-phase-action">{model.phaseAtAction}</div>
      <div data-testid="rule-14-interactions">
        {model.interactions.join(", ")}
      </div>
      <button
        data-testid="rule-14-interact"
        onClick={() =>
          actions.dispatch(LifecycleActions.UserInteraction, "test")
        }
      >
        Test Phase
      </button>
    </section>
  );
}

/**
 * Rule 15 Test: Mounting phase delivers cached values
 * This test has two components: a sender that caches a value,
 * and a receiver that mounts later to receive the cached value.
 */
function CacheSender() {
  const [, actions] = useCacheSenderActions();

  return (
    <div data-testid="rule-15-sender">
      {/* consume() creates a Partition that caches dispatched values for late-mounting subscribers */}
      {actions.consume(CachedActions.CachedData, () => null)}
      <button
        data-testid="rule-15-send"
        onClick={() =>
          actions.dispatch(CachedActions.CachedData, {
            value: "cached-payload",
            timestamp: Date.now(),
          })
        }
      >
        Send Cached Data
      </button>
    </div>
  );
}

function CacheReceiver({ id }: { id: string }) {
  const [model] = useCacheReceiverActions();

  return (
    <div data-testid={`rule-15-receiver-${id}`}>
      <div data-testid={`rule-15-received-${id}`}>{model.receivedData}</div>
      <div data-testid={`rule-15-phase-${id}`}>{model.phaseWhenReceived}</div>
      <div data-testid={`rule-15-count-${id}`}>{model.receiveCount}</div>
    </div>
  );
}

function Rule15CachedValues() {
  const [showReceiver, setShowReceiver] = React.useState(false);
  const [showSecondReceiver, setShowSecondReceiver] = React.useState(false);

  return (
    <section data-testid="rule-15">
      <h3>Rule 15: Cached Values on Mount</h3>
      <CacheSender />
      {showReceiver && <CacheReceiver id="1" />}
      {showSecondReceiver && <CacheReceiver id="2" />}
      <button
        data-testid="rule-15-show-receiver"
        onClick={() => setShowReceiver(true)}
      >
        Mount Receiver 1
      </button>
      <button
        data-testid="rule-15-show-second"
        onClick={() => setShowSecondReceiver(true)}
      >
        Mount Receiver 2
      </button>
      <button
        data-testid="rule-15-hide-receiver"
        onClick={() => setShowReceiver(false)}
      >
        Unmount Receiver 1
      </button>
    </section>
  );
}

/**
 * Wrapper to test unmount lifecycle
 */
function UnmountTestWrapper() {
  const [showChild, setShowChild] = React.useState(true);
  const [unmountEvents, setUnmountEvents] = React.useState<string[]>([]);

  return (
    <section data-testid="rule-13-unmount-test">
      <h3>Unmount Test</h3>
      {showChild && <Rule13LifecycleActions />}
      <button
        data-testid="rule-13-toggle"
        onClick={() => setShowChild((prev) => !prev)}
      >
        {showChild ? "Unmount" : "Mount"}
      </button>
      <div data-testid="rule-13-unmount-events">{unmountEvents.join(", ")}</div>
    </section>
  );
}

export function LifecyclesFixture() {
  return (
    <div data-testid="lifecycles-fixture">
      <h2>Rules 13-15: Lifecycles</h2>
      <UnmountTestWrapper />
      <Rule14PhaseContext />
      <Rule15CachedValues />
    </div>
  );
}
