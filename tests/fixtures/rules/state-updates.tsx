/**
 * E2E Test Fixtures for Rules 5-7: State Updates
 *
 * Rule 5: Always use produce() for state mutations
 * Rule 6: Use annotations for trackable state changes
 * Rule 7: Nested produce() calls are allowed
 */
import * as React from "react";
import { Action, useActions, Op } from "../../../src/library/index.ts";

class Actions {
  static SetValue = Action<number>("SetValue");
  static UpdateWithAnnotation = Action<string>("UpdateWithAnnotation");
  static NestedUpdate = Action<{ step1: string; step2: string }>(
    "NestedUpdate",
  );
  static MultiStepAsync = Action("MultiStepAsync");
}

type Model = {
  value: number;
  annotatedData: string;
  step1Result: string;
  step2Result: string;
  asyncStatus: string;
  history: string[];
};

// ============================================================================
// Custom Hooks
// ============================================================================

function useRule5Actions() {
  const actions = useActions<Model, typeof Actions>({
    value: 0,
    annotatedData: "",
    step1Result: "",
    step2Result: "",
    asyncStatus: "idle",
    history: [],
  });

  actions.useAction(Actions.SetValue, (context, newValue) => {
    // Rule 5: All mutations must go through produce()
    context.actions.produce((draft) => {
      draft.model.value = newValue;
      draft.model.history = [...draft.model.history, `Set to ${newValue}`];
    });
  });

  return actions;
}

function useRule6Actions() {
  const actions = useActions<Model, typeof Actions>({
    value: 0,
    annotatedData: "initial",
    step1Result: "",
    step2Result: "",
    asyncStatus: "idle",
    history: [],
  });

  actions.useAction(Actions.UpdateWithAnnotation, async (context, newData) => {
    // Mark the update as pending with an annotation
    context.actions.produce((draft) => {
      draft.model.annotatedData = context.actions.annotate(Op.Update, newData);
    });

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Complete the update
    context.actions.produce((draft) => {
      draft.model.annotatedData = newData;
    });
  });

  return actions;
}

function useRule7Actions() {
  const actions = useActions<Model, typeof Actions>({
    value: 0,
    annotatedData: "",
    step1Result: "",
    step2Result: "",
    asyncStatus: "idle",
    history: [],
  });

  actions.useAction(Actions.NestedUpdate, (context, { step1, step2 }) => {
    // First produce() call
    context.actions.produce((draft) => {
      draft.model.step1Result = step1;
    });

    // Second (nested) produce() call - Immertation handles merging
    context.actions.produce((draft) => {
      draft.model.step2Result = step2;
    });
  });

  actions.useAction(Actions.MultiStepAsync, async (context) => {
    // Multiple produce() calls in async handler
    context.actions.produce((draft) => {
      draft.model.asyncStatus = "loading";
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    context.actions.produce((draft) => {
      draft.model.asyncStatus = "processing";
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    context.actions.produce((draft) => {
      draft.model.asyncStatus = "complete";
    });
  });

  return actions;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Rule 5 Test: Using produce() for state mutations
 */
function Rule5ProduceMutations() {
  const [model, actions] = useRule5Actions();

  return (
    <section data-testid="rule-5">
      <h3>Rule 5: produce() for Mutations</h3>
      <div data-testid="rule-5-value">{model.value}</div>
      <div data-testid="rule-5-history">{model.history.join(" -> ")}</div>
      <button
        data-testid="rule-5-set-10"
        onClick={() => actions.dispatch(Actions.SetValue, 10)}
      >
        Set 10
      </button>
      <button
        data-testid="rule-5-set-42"
        onClick={() => actions.dispatch(Actions.SetValue, 42)}
      >
        Set 42
      </button>
      <button
        data-testid="rule-5-set-100"
        onClick={() => actions.dispatch(Actions.SetValue, 100)}
      >
        Set 100
      </button>
    </section>
  );
}

/**
 * Rule 6 Test: Annotations for trackable state changes
 */
function Rule6Annotations() {
  const [model, actions] = useRule6Actions();

  const isPending = actions.inspect.annotatedData.pending();
  const draftValue = actions.inspect.annotatedData.draft();

  return (
    <section data-testid="rule-6">
      <h3>Rule 6: Annotations</h3>
      <div data-testid="rule-6-data">{model.annotatedData}</div>
      <div data-testid="rule-6-pending">
        {isPending ? "pending" : "settled"}
      </div>
      <div data-testid="rule-6-draft">{String(draftValue)}</div>
      <button
        data-testid="rule-6-update"
        onClick={() =>
          actions.dispatch(Actions.UpdateWithAnnotation, "updated-value")
        }
      >
        Update with Annotation
      </button>
    </section>
  );
}

/**
 * Rule 7 Test: Nested produce() calls
 */
function Rule7NestedProduce() {
  const [model, actions] = useRule7Actions();

  return (
    <section data-testid="rule-7">
      <h3>Rule 7: Nested produce()</h3>
      <div data-testid="rule-7-step1">{model.step1Result}</div>
      <div data-testid="rule-7-step2">{model.step2Result}</div>
      <div data-testid="rule-7-async-status">{model.asyncStatus}</div>
      <button
        data-testid="rule-7-nested"
        onClick={() =>
          actions.dispatch(Actions.NestedUpdate, {
            step1: "first-step",
            step2: "second-step",
          })
        }
      >
        Nested Update
      </button>
      <button
        data-testid="rule-7-async"
        onClick={() => actions.dispatch(Actions.MultiStepAsync)}
      >
        Multi-Step Async
      </button>
    </section>
  );
}

export function StateUpdatesFixture() {
  return (
    <div data-testid="state-updates-fixture">
      <h2>Rules 5-7: State Updates</h2>
      <Rule5ProduceMutations />
      <Rule6Annotations />
      <Rule7NestedProduce />
    </div>
  );
}
