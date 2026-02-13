/**
 * E2E Test Fixtures for Rules 16, 18-19, 40: Broadcast Actions
 *
 * Rule 16: Only broadcast actions support reactive subscription
 * Rule 18: Late-mounting components receive cached values
 * Rule 19: Use channeled actions for targeted broadcast delivery
 * Rule 40: Use context.actions.consume to consume broadcast values in handlers
 */
import * as React from "react";
import {
  Action,
  Distribution,
  Lifecycle,
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

// Channeled broadcast actions
class ChanneledBroadcastActions {
  static UserUpdated = Action<
    { id: number; name: string; email: string },
    { UserId: number }
  >("UserUpdated", Distribution.Broadcast);
  static ChannelMessage = Action<
    { channel: string; message: string },
    { Channel: string }
  >("ChannelMessage", Distribution.Broadcast);
}

type EmptyModel = Record<string, never>;

type ChanneledModel = {
  user1Data: string;
  user2Data: string;
  generalChannel: string;
  techChannel: string;
  allMessages: number;
};

// ============================================================================
// Custom Hooks
// ============================================================================

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

function useChanneledPublisherActions() {
  const actions = useActions<EmptyModel, typeof ChanneledBroadcastActions>({});
  return actions;
}

function useChanneledSubscriberActions() {
  const actions = useActions<ChanneledModel, typeof ChanneledBroadcastActions>({
    user1Data: "",
    user2Data: "",
    generalChannel: "",
    techChannel: "",
    allMessages: 0,
  });

  // Channeled handler for user 1 only
  actions.useAction(
    ChanneledBroadcastActions.UserUpdated({ UserId: 1 }),
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user1Data = `${user.name} <${user.email}>`;
      });
    },
  );

  // Channeled handler for user 2 only
  actions.useAction(
    ChanneledBroadcastActions.UserUpdated({ UserId: 2 }),
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user2Data = `${user.name} <${user.email}>`;
      });
    },
  );

  // Handler for general channel
  actions.useAction(
    ChanneledBroadcastActions.ChannelMessage({ Channel: "general" }),
    (context, msg) => {
      context.actions.produce((draft) => {
        draft.model.generalChannel = msg.message;
      });
    },
  );

  // Handler for tech channel
  actions.useAction(
    ChanneledBroadcastActions.ChannelMessage({ Channel: "tech" }),
    (context, msg) => {
      context.actions.produce((draft) => {
        draft.model.techChannel = msg.message;
      });
    },
  );

  // Plain handler receives ALL dispatches
  actions.useAction(ChanneledBroadcastActions.ChannelMessage, (context) => {
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
 * Rule 19 Test: Channeled actions for targeted broadcast delivery
 */
function ChanneledBroadcastPublisher() {
  const [, actions] = useChanneledPublisherActions();

  return (
    <div data-testid="rule-19-publisher">
      <button
        data-testid="rule-19-update-user1"
        onClick={() =>
          actions.dispatch(
            ChanneledBroadcastActions.UserUpdated({ UserId: 1 }),
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
            ChanneledBroadcastActions.UserUpdated({ UserId: 2 }),
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
          actions.dispatch(ChanneledBroadcastActions.UserUpdated, {
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
            ChanneledBroadcastActions.ChannelMessage({ Channel: "general" }),
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
            ChanneledBroadcastActions.ChannelMessage({ Channel: "tech" }),
            { channel: "tech", message: "Hello tech!" },
          )
        }
      >
        Message Tech
      </button>
    </div>
  );
}

function ChanneledBroadcastSubscriber() {
  const [model] = useChanneledSubscriberActions();

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

function Rule19ChanneledBroadcast() {
  return (
    <section data-testid="rule-19">
      <h3>Rule 19: Channeled Broadcast Delivery</h3>
      <ChanneledBroadcastPublisher />
      <ChanneledBroadcastSubscriber />
    </section>
  );
}

// ============================================================================
// Rule 40: Use context.actions.consume to consume broadcast values in handlers
// ============================================================================

class Rule40Actions {
  static Trigger = Action("Trigger");
}

type Rule40Model = {
  consumed: string;
};

function Rule40Publisher() {
  const [, actions] = useActions<EmptyModel, typeof BroadcastActions>({});

  return (
    <button
      data-testid="rule-40-publish"
      onClick={() =>
        actions.dispatch(BroadcastActions.UserLoggedIn, {
          name: "Charlie",
          id: 3,
        })
      }
    >
      Publish User
    </button>
  );
}

function useRule40ConsumerActions() {
  const actions = useActions<
    Rule40Model,
    typeof Rule40Actions & typeof BroadcastActions
  >({
    consumed: "",
  });

  actions.useAction(Lifecycle.Mount, async (context) => {
    const user = await context.actions.consume(BroadcastActions.UserLoggedIn);
    if (!user) return;
    context.actions.produce(({ model }) => {
      model.consumed = user.name;
    });
  });

  actions.useAction(Rule40Actions.Trigger, async (context) => {
    const user = await context.actions.consume(BroadcastActions.UserLoggedIn);
    context.actions.produce(({ model }) => {
      model.consumed = user ? user.name : "null";
    });
  });

  return actions;
}

function Rule40Consumer() {
  const [model, actions] = useRule40ConsumerActions();

  return (
    <div data-testid="rule-40-consumer">
      <div data-testid="rule-40-consumed">{model.consumed}</div>
      <button
        data-testid="rule-40-trigger"
        onClick={() => actions.dispatch(Rule40Actions.Trigger)}
      >
        Read via consume
      </button>
    </div>
  );
}

function Rule40HandlerRead() {
  const [showConsumer, setShowConsumer] = React.useState(false);

  return (
    <section data-testid="rule-40">
      <h3>Rule 40: Handler-side consume()</h3>
      <Rule40Publisher />
      {showConsumer && <Rule40Consumer />}
      <button
        data-testid="rule-40-mount-consumer"
        onClick={() => setShowConsumer(true)}
      >
        Mount Consumer
      </button>
    </section>
  );
}

export function BroadcastActionsFixture() {
  return (
    <div data-testid="broadcast-actions-fixture">
      <h2>Rules 16, 18-19, 40: Broadcast Actions</h2>
      <Rule18LateMounting />
      <Rule19ChanneledBroadcast />
      <Rule40HandlerRead />
    </div>
  );
}
