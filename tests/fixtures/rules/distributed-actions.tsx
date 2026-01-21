/**
 * E2E Test Fixtures for Rules 16-19: Distributed Actions
 *
 * Rule 16: Only broadcast actions can be consumed
 * Rule 17: Use consume() for reactive UI from broadcast actions
 * Rule 18: Late-mounting components receive cached values
 * Rule 19: Use filtered actions for targeted broadcast delivery
 */
import * as React from "react";
import {
  Action,
  Distribution,
  useActions,
} from "../../../src/library/index.ts";

// Broadcast actions that can be consumed
class BroadcastActions {
  static UserLoggedIn = Action<{ name: string; id: number }>(
    "UserLoggedIn",
    Distribution.Broadcast,
  );
  static Counter = Action<number>("Counter", Distribution.Broadcast);
  static DataLoaded = Action<{ items: string[] }>(
    "DataLoaded",
    Distribution.Broadcast,
  );
}

// Filtered broadcast actions
class FilteredBroadcastActions {
  static UserUpdated = Action<{ id: number; name: string; email: string }>(
    "UserUpdated",
    Distribution.Broadcast,
  );
  static ChannelMessage = Action<{ channel: string; message: string }>(
    "ChannelMessage",
    Distribution.Broadcast,
  );
}

type EmptyModel = Record<string, never>;

type ConsumeModel = {
  traditionalUser: string;
};

type FilteredModel = {
  user1Data: string;
  user2Data: string;
  generalChannel: string;
  techChannel: string;
  allMessages: number;
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useRule16And17Actions() {
  const actions = useActions<ConsumeModel, typeof BroadcastActions>({
    traditionalUser: "",
  });

  // Traditional handler approach
  actions.useAction(BroadcastActions.UserLoggedIn, (context, user) => {
    context.actions.produce((draft) => {
      draft.model.traditionalUser = user.name;
    });
  });

  return actions;
}

function useLateMountingPublisherActions() {
  const actions = useActions<EmptyModel, typeof BroadcastActions>({});
  return actions;
}

function useLateMountingSubscriberActions(
  setReceivedPhase: (phase: string) => void,
) {
  const actions = useActions<{ data: string[] }, typeof BroadcastActions>({
    data: [],
  });

  actions.useAction(BroadcastActions.DataLoaded, (context, payload) => {
    setReceivedPhase(context.phase);
    context.actions.produce((draft) => {
      draft.model.data = payload.items;
    });
  });

  return actions;
}

function useFilteredPublisherActions() {
  const actions = useActions<EmptyModel, typeof FilteredBroadcastActions>({});
  return actions;
}

function useFilteredSubscriberActions() {
  const actions = useActions<FilteredModel, typeof FilteredBroadcastActions>({
    user1Data: "",
    user2Data: "",
    generalChannel: "",
    techChannel: "",
    allMessages: 0,
  });

  // Filtered handler for user 1 only
  actions.useAction(
    [FilteredBroadcastActions.UserUpdated, { UserId: 1 }],
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user1Data = `${user.name} <${user.email}>`;
      });
    },
  );

  // Filtered handler for user 2 only
  actions.useAction(
    [FilteredBroadcastActions.UserUpdated, { UserId: 2 }],
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user2Data = `${user.name} <${user.email}>`;
      });
    },
  );

  // Handler for general channel
  actions.useAction(
    [FilteredBroadcastActions.ChannelMessage, { Channel: "general" }],
    (context, msg) => {
      context.actions.produce((draft) => {
        draft.model.generalChannel = msg.message;
      });
    },
  );

  // Handler for tech channel
  actions.useAction(
    [FilteredBroadcastActions.ChannelMessage, { Channel: "tech" }],
    (context, msg) => {
      context.actions.produce((draft) => {
        draft.model.techChannel = msg.message;
      });
    },
  );

  // Plain handler receives ALL dispatches
  actions.useAction(FilteredBroadcastActions.ChannelMessage, (context) => {
    context.actions.produce((draft) => {
      draft.model.allMessages += 1;
    });
  });

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 16 & 17 Test: consume() for reactive UI from broadcast actions
 * Only broadcast actions can be consumed.
 */
function Rule16And17Consume() {
  const [model, actions] = useRule16And17Actions();

  return (
    <section data-testid="rule-16-17">
      <h3>Rules 16 & 17: consume() for Broadcast</h3>

      {/* Dispatch buttons */}
      <div data-testid="rule-16-17-controls">
        <button
          data-testid="rule-16-17-login"
          onClick={() =>
            actions.dispatch(BroadcastActions.UserLoggedIn, {
              name: "Alice",
              id: 1,
            })
          }
        >
          Login Alice
        </button>
        <button
          data-testid="rule-16-17-login-bob"
          onClick={() =>
            actions.dispatch(BroadcastActions.UserLoggedIn, {
              name: "Bob",
              id: 2,
            })
          }
        >
          Login Bob
        </button>
        <button
          data-testid="rule-16-17-counter"
          onClick={() => actions.dispatch(BroadcastActions.Counter, 42)}
        >
          Set Counter
        </button>
        <button
          data-testid="rule-16-17-data"
          onClick={() =>
            actions.dispatch(BroadcastActions.DataLoaded, {
              items: ["apple", "banana", "cherry"],
            })
          }
        >
          Load Data
        </button>
      </div>

      {/* Traditional handler result */}
      <div data-testid="rule-16-17-traditional">{model.traditionalUser}</div>

      {/* Rule 17: consume() for reactive UI */}
      <div data-testid="rule-16-17-consumed-user">
        {actions.consume(BroadcastActions.UserLoggedIn, (box) => (
          <span>
            Welcome, {box.value.name} (ID: {box.value.id})
          </span>
        ))}
      </div>

      <div data-testid="rule-16-17-consumed-counter">
        {actions.consume(BroadcastActions.Counter, (box) => (
          <span>Counter: {box.value}</span>
        ))}
      </div>

      <div data-testid="rule-16-17-consumed-data">
        {actions.consume(BroadcastActions.DataLoaded, (box) => (
          <ul>
            {box.value.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

/**
 * Rule 18 Test: Late-mounting components receive cached values
 */
function LateMountingPublisher() {
  const [, actions] = useLateMountingPublisherActions();

  return (
    <div data-testid="rule-18-publisher">
      <button
        data-testid="rule-18-publish"
        onClick={() =>
          actions.dispatch(BroadcastActions.DataLoaded, {
            items: ["cached-item-1", "cached-item-2"],
          })
        }
      >
        Publish Data
      </button>
    </div>
  );
}

function LateMountingSubscriber({ id }: { id: string }) {
  const [receivedPhase, setReceivedPhase] = React.useState("");
  const [model] = useLateMountingSubscriberActions(setReceivedPhase);

  return (
    <div data-testid={`rule-18-subscriber-${id}`}>
      <div data-testid={`rule-18-data-${id}`}>{model.data.join(", ")}</div>
      <div data-testid={`rule-18-phase-${id}`}>{receivedPhase}</div>
    </div>
  );
}

function Rule18LateMounting() {
  const [showSubscriber1, setShowSubscriber1] = React.useState(false);
  const [showSubscriber2, setShowSubscriber2] = React.useState(false);

  return (
    <section data-testid="rule-18">
      <h3>Rule 18: Late-Mounting Receives Cache</h3>
      <LateMountingPublisher />
      {showSubscriber1 && <LateMountingSubscriber id="1" />}
      {showSubscriber2 && <LateMountingSubscriber id="2" />}
      <button
        data-testid="rule-18-mount-sub1"
        onClick={() => setShowSubscriber1(true)}
      >
        Mount Subscriber 1
      </button>
      <button
        data-testid="rule-18-mount-sub2"
        onClick={() => setShowSubscriber2(true)}
      >
        Mount Subscriber 2
      </button>
      <button
        data-testid="rule-18-unmount-sub1"
        onClick={() => setShowSubscriber1(false)}
      >
        Unmount Subscriber 1
      </button>
    </section>
  );
}

/**
 * Rule 19 Test: Filtered actions for targeted broadcast delivery
 */
function FilteredBroadcastPublisher() {
  const [, actions] = useFilteredPublisherActions();

  return (
    <div data-testid="rule-19-publisher">
      <button
        data-testid="rule-19-update-user1"
        onClick={() =>
          actions.dispatch(
            [FilteredBroadcastActions.UserUpdated, { UserId: 1 }],
            {
              id: 1,
              name: "Alice Updated",
              email: "alice@example.com",
            },
          )
        }
      >
        Update User 1
      </button>
      <button
        data-testid="rule-19-update-user2"
        onClick={() =>
          actions.dispatch(
            [FilteredBroadcastActions.UserUpdated, { UserId: 2 }],
            {
              id: 2,
              name: "Bob Updated",
              email: "bob@example.com",
            },
          )
        }
      >
        Update User 2
      </button>
      <button
        data-testid="rule-19-update-all-users"
        onClick={() =>
          actions.dispatch(FilteredBroadcastActions.UserUpdated, {
            id: 0,
            name: "Broadcast to All",
            email: "all@example.com",
          })
        }
      >
        Update All Users
      </button>
      <button
        data-testid="rule-19-msg-general"
        onClick={() =>
          actions.dispatch(
            [FilteredBroadcastActions.ChannelMessage, { Channel: "general" }],
            { channel: "general", message: "Hello general!" },
          )
        }
      >
        Message General
      </button>
      <button
        data-testid="rule-19-msg-tech"
        onClick={() =>
          actions.dispatch(
            [FilteredBroadcastActions.ChannelMessage, { Channel: "tech" }],
            { channel: "tech", message: "Hello tech!" },
          )
        }
      >
        Message Tech
      </button>
    </div>
  );
}

function FilteredBroadcastSubscriber() {
  const [model] = useFilteredSubscriberActions();

  return (
    <div data-testid="rule-19-subscriber">
      <div data-testid="rule-19-user1">{model.user1Data}</div>
      <div data-testid="rule-19-user2">{model.user2Data}</div>
      <div data-testid="rule-19-general">{model.generalChannel}</div>
      <div data-testid="rule-19-tech">{model.techChannel}</div>
      <div data-testid="rule-19-all-count">{model.allMessages}</div>
    </div>
  );
}

function Rule19FilteredBroadcast() {
  return (
    <section data-testid="rule-19">
      <h3>Rule 19: Filtered Broadcast Delivery</h3>
      <FilteredBroadcastPublisher />
      <FilteredBroadcastSubscriber />
    </section>
  );
}

export function DistributedActionsFixture() {
  return (
    <div data-testid="distributed-actions-fixture">
      <h2>Rules 16-19: Distributed Actions</h2>
      <Rule16And17Consume />
      <Rule18LateMounting />
      <Rule19FilteredBroadcast />
    </div>
  );
}
