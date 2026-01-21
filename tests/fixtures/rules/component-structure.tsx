/**
 * E2E Test Fixtures for Rules 32-35: Component Structure
 *
 * Rule 32: Use <Boundary> to isolate distributed actions
 * Rule 33: One useActions call per component
 * Rule 34: Use .box() to pass slice state to child components
 * Rule 35: Use .context() to pass the entire context to child components
 */
import * as React from "react";
import {
  Action,
  Distribution,
  useActions,
  Boundary,
  type Box,
} from "../../../src/library/index.ts";

// Distributed actions for boundary test
class GlobalActions {
  static GlobalCounter = Action<number>(
    "GlobalCounter",
    Distribution.Broadcast,
  );
  static GlobalMessage = Action<string>(
    "GlobalMessage",
    Distribution.Broadcast,
  );
}

// Local actions for component structure tests
class LocalActions {
  static UpdateName = Action<string>("UpdateName");
  static UpdateAge = Action<number>("UpdateAge");
  static UpdateEmail = Action<string>("UpdateEmail");
}

type GlobalModel = {
  counter: number;
  message: string;
  receiveCount: number;
};

type ProfileModel = {
  name: string;
  age: number;
  email: string;
};

/**
 * Custom hook for global publisher (no handlers, just dispatch)
 */
function useGlobalPublisherActions() {
  const actions = useActions<GlobalModel, typeof GlobalActions>({
    counter: 0,
    message: "",
    receiveCount: 0,
  });
  return actions;
}

/**
 * Custom hook for global subscriber
 */
function useGlobalSubscriberActions() {
  const actions = useActions<GlobalModel, typeof GlobalActions>({
    counter: 0,
    message: "",
    receiveCount: 0,
  });

  actions.useAction(GlobalActions.GlobalCounter, (context, value) => {
    context.actions.produce((draft) => {
      draft.model.counter = value;
      draft.model.receiveCount += 1;
    });
  });

  actions.useAction(GlobalActions.GlobalMessage, (context, message) => {
    context.actions.produce((draft) => {
      draft.model.message = message;
      draft.model.receiveCount += 1;
    });
  });

  return actions;
}

/**
 * Custom hook for isolated feature inside boundary
 */
function useIsolatedFeatureActions() {
  const actions = useActions<GlobalModel, typeof GlobalActions>({
    counter: 0,
    message: "",
    receiveCount: 0,
  });

  actions.useAction(GlobalActions.GlobalCounter, (context, value) => {
    context.actions.produce((draft) => {
      draft.model.counter = value;
      draft.model.receiveCount += 1;
    });
  });

  return actions;
}

/**
 * Rule 32 Test: <Boundary> for isolating distributed actions
 */
function GlobalPublisher() {
  const [, actions] = useGlobalPublisherActions();

  return (
    <div data-testid="rule-32-publisher">
      <button
        data-testid="rule-32-publish-counter"
        onClick={() =>
          actions.dispatch(GlobalActions.GlobalCounter, Date.now())
        }
      >
        Publish Counter
      </button>
      <button
        data-testid="rule-32-publish-message"
        onClick={() =>
          actions.dispatch(
            GlobalActions.GlobalMessage,
            `Message at ${Date.now()}`,
          )
        }
      >
        Publish Message
      </button>
    </div>
  );
}

function GlobalSubscriber({ id }: { id: string }) {
  const [model] = useGlobalSubscriberActions();

  return (
    <div data-testid={`rule-32-subscriber-${id}`}>
      <div data-testid={`rule-32-counter-${id}`}>{model.counter}</div>
      <div data-testid={`rule-32-message-${id}`}>{model.message}</div>
      <div data-testid={`rule-32-count-${id}`}>{model.receiveCount}</div>
    </div>
  );
}

function IsolatedFeature() {
  // This component is inside a Boundary - its distributed actions are isolated
  const [model, actions] = useIsolatedFeatureActions();

  return (
    <div data-testid="rule-32-isolated">
      <div data-testid="rule-32-isolated-counter">{model.counter}</div>
      <div data-testid="rule-32-isolated-count">{model.receiveCount}</div>
      <button
        data-testid="rule-32-isolated-publish"
        onClick={() => actions.dispatch(GlobalActions.GlobalCounter, 999)}
      >
        Publish Inside Boundary
      </button>
    </div>
  );
}

function Rule32Boundary() {
  return (
    <section data-testid="rule-32">
      <h3>Rule 32: Boundary Isolation</h3>

      {/* Global publisher and subscriber - outside boundary */}
      <GlobalPublisher />
      <GlobalSubscriber id="outside" />

      {/* Isolated feature inside a Boundary */}
      <div
        style={{ border: "2px dashed red", padding: "8px", margin: "8px 0" }}
      >
        <strong>Inside Boundary (Isolated):</strong>
        <Boundary>
          <IsolatedFeature />
        </Boundary>
      </div>
    </section>
  );
}

/**
 * Custom hook for Rule 33: One useActions call per component
 */
function useRule33Actions() {
  const actions = useActions<ProfileModel, typeof LocalActions>({
    name: "",
    age: 0,
    email: "",
  });

  actions.useAction(LocalActions.UpdateName, (context, name) => {
    context.actions.produce((draft) => {
      draft.model.name = name;
    });
  });

  actions.useAction(LocalActions.UpdateAge, (context, age) => {
    context.actions.produce((draft) => {
      draft.model.age = age;
    });
  });

  actions.useAction(LocalActions.UpdateEmail, (context, email) => {
    context.actions.produce((draft) => {
      draft.model.email = email;
    });
  });

  return actions;
}

/**
 * Rule 33 Test: One useActions call per component
 * This is a best practice - multiple calls create separate state instances
 */
function Rule33SingleUseActions() {
  // Single useActions call via custom hook - this is the correct pattern
  const [model, actions] = useRule33Actions();

  return (
    <section data-testid="rule-33">
      <h3>Rule 33: Single useActions</h3>
      <div data-testid="rule-33-name">{model.name}</div>
      <div data-testid="rule-33-age">{model.age}</div>
      <div data-testid="rule-33-email">{model.email}</div>
      <button
        data-testid="rule-33-set-name"
        onClick={() => actions.dispatch(LocalActions.UpdateName, "Alice")}
      >
        Set Name
      </button>
      <button
        data-testid="rule-33-set-age"
        onClick={() => actions.dispatch(LocalActions.UpdateAge, 30)}
      >
        Set Age
      </button>
      <button
        data-testid="rule-33-set-email"
        onClick={() =>
          actions.dispatch(LocalActions.UpdateEmail, "alice@example.com")
        }
      >
        Set Email
      </button>
    </section>
  );
}

/**
 * Custom hook for Rule 34: .box() for passing slice state
 */
function useRule34Actions() {
  const actions = useActions<ProfileModel, typeof LocalActions>({
    name: "Alice",
    age: 25,
    email: "alice@example.com",
  });

  actions.useAction(LocalActions.UpdateName, (context, name) => {
    context.actions.produce((draft) => {
      draft.model.name = name;
    });
  });

  actions.useAction(LocalActions.UpdateEmail, (context, email) => {
    context.actions.produce((draft) => {
      draft.model.email = email;
    });
  });

  return actions;
}

/**
 * Rule 34 Test: .box() for passing slice state
 * Note: The library uses manual Box creation, not a .box() method
 */
type UserSlice = { name: string; email: string };

function ProfileCard({ user }: { user: Box<UserSlice> }) {
  return (
    <div data-testid="rule-34-profile-card">
      <div data-testid="rule-34-card-name">{user.value.name}</div>
      <div data-testid="rule-34-card-email">{user.value.email}</div>
      <div data-testid="rule-34-card-pending">
        {user.inspect.pending() ? "pending" : "idle"}
      </div>
    </div>
  );
}

function Rule34BoxSlices() {
  const [model, actions] = useRule34Actions();

  // Create a Box manually for the user slice
  // In practice, this would be: actions.box((m) => ({ name: m.name, email: m.email }))
  const userBox: Box<UserSlice> = {
    value: { name: model.name, email: model.email },
    inspect: {
      pending: () =>
        actions.inspect.name.pending() || actions.inspect.email.pending(),
      settled: () => Promise.resolve({ name: model.name, email: model.email }),
      draft: () => ({ name: model.name, email: model.email }),
      remaining: () => 0,
      is: () => false,
    } as Box<UserSlice>["inspect"],
  };

  return (
    <section data-testid="rule-34">
      <h3>Rule 34: Box Slices</h3>
      <ProfileCard user={userBox} />
      <button
        data-testid="rule-34-update-name"
        onClick={() => actions.dispatch(LocalActions.UpdateName, "Bob")}
      >
        Update Name
      </button>
      <button
        data-testid="rule-34-update-email"
        onClick={() =>
          actions.dispatch(LocalActions.UpdateEmail, "bob@example.com")
        }
      >
        Update Email
      </button>
    </section>
  );
}

/**
 * Custom hook for Rule 35: .context() for passing entire context
 */
function useRule35Actions() {
  const actions = useActions<ProfileModel, typeof LocalActions>({
    name: "Initial",
    age: 0,
    email: "initial@example.com",
  });

  actions.useAction(LocalActions.UpdateName, (context, name) => {
    context.actions.produce((draft) => {
      draft.model.name = name;
    });
  });

  actions.useAction(LocalActions.UpdateEmail, (context, email) => {
    context.actions.produce((draft) => {
      draft.model.email = email;
    });
  });

  return actions;
}

/**
 * Rule 35 Test: .context() for passing entire context
 * This allows children to update parent state
 */
type ContextForChild = {
  dispatch: (action: symbol, payload?: unknown) => void;
  model: ProfileModel;
};

function ProfileEditor({ context }: { context: ContextForChild }) {
  const [localName, setLocalName] = React.useState("");
  const [localEmail, setLocalEmail] = React.useState("");

  return (
    <div data-testid="rule-35-editor">
      <input
        data-testid="rule-35-name-input"
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        placeholder="Name"
      />
      <input
        data-testid="rule-35-email-input"
        value={localEmail}
        onChange={(e) => setLocalEmail(e.target.value)}
        placeholder="Email"
      />
      <button
        data-testid="rule-35-save-name"
        onClick={() => context.dispatch(LocalActions.UpdateName, localName)}
      >
        Save Name
      </button>
      <button
        data-testid="rule-35-save-email"
        onClick={() => context.dispatch(LocalActions.UpdateEmail, localEmail)}
      >
        Save Email
      </button>
      <div data-testid="rule-35-current-name">{context.model.name}</div>
      <div data-testid="rule-35-current-email">{context.model.email}</div>
    </div>
  );
}

function Rule35Context() {
  const [model, actions] = useRule35Actions();

  // Pass context to child (dispatch + model)
  const childContext: ContextForChild = {
    dispatch: actions.dispatch,
    model,
  };

  return (
    <section data-testid="rule-35">
      <h3>Rule 35: Context Passing</h3>
      <div data-testid="rule-35-parent-name">{model.name}</div>
      <div data-testid="rule-35-parent-email">{model.email}</div>
      <ProfileEditor context={childContext} />
    </section>
  );
}

export function ComponentStructureFixture() {
  return (
    <div data-testid="component-structure-fixture">
      <h2>Rules 32-35: Component Structure</h2>
      <Rule32Boundary />
      <Rule33SingleUseActions />
      <Rule34BoxSlices />
      <Rule35Context />
    </div>
  );
}
