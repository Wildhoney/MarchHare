/**
 * E2E Test Fixtures for Rehydration
 *
 * Tests that component state is preserved across unmount/remount cycles
 * when using Rehydrate(), and that non-rehydrated components reset.
 */
import * as React from "react";
import {
  Action,
  useActions,
  Rehydrate,
  Id,
} from "../../../src/library/index.ts";

class RehydrateActions {
  static Increment = Action("Increment");
}

type RehydrateModel = {
  count: number;
};

const initialModel: RehydrateModel = { count: 0 };

class Store {
  static Counter = Id<RehydrateModel, { UserId: number }>();
}

function useRehydrateActions(userId: number) {
  const actions = useActions<RehydrateModel, typeof RehydrateActions>(
    Rehydrate(initialModel, Store.Counter({ UserId: userId })),
  );

  actions.useAction(RehydrateActions.Increment, (context) => {
    context.actions.produce(({ model }) => {
      model.count += 1;
    });
  });

  return actions;
}

function RehydrateChild({ userId }: { userId: number }) {
  const [model, actions] = useRehydrateActions(userId);

  return (
    <div>
      <div data-testid={`rehydrate-count-${userId}`}>{model.count}</div>
      <button
        data-testid={`rehydrate-increment-${userId}`}
        onClick={() => actions.dispatch(RehydrateActions.Increment)}
      >
        Increment
      </button>
    </div>
  );
}

function usePlainActions() {
  const actions = useActions<RehydrateModel, typeof RehydrateActions>(
    initialModel,
  );

  actions.useAction(RehydrateActions.Increment, (context) => {
    context.actions.produce(({ model }) => {
      model.count += 1;
    });
  });

  return actions;
}

function PlainChild() {
  const [model, actions] = usePlainActions();

  return (
    <div>
      <div data-testid="plain-count">{model.count}</div>
      <button
        data-testid="plain-increment"
        onClick={() => actions.dispatch(RehydrateActions.Increment)}
      >
        Increment
      </button>
    </div>
  );
}

export function RehydrateFixture() {
  const [showUser1, setShowUser1] = React.useState(true);
  const [showUser2, setShowUser2] = React.useState(true);
  const [showPlain, setShowPlain] = React.useState(true);

  return (
    <div data-testid="rehydrate-fixture">
      <button
        data-testid="toggle-user-1"
        onClick={() => setShowUser1((v) => !v)}
      >
        Toggle User 1
      </button>
      <button
        data-testid="toggle-user-2"
        onClick={() => setShowUser2((v) => !v)}
      >
        Toggle User 2
      </button>
      <button
        data-testid="toggle-plain"
        onClick={() => setShowPlain((v) => !v)}
      >
        Toggle Plain
      </button>

      <div data-testid="user-1-mounted">{showUser1 ? "yes" : "no"}</div>
      <div data-testid="user-2-mounted">{showUser2 ? "yes" : "no"}</div>
      <div data-testid="plain-mounted">{showPlain ? "yes" : "no"}</div>

      {showUser1 && <RehydrateChild userId={1} />}
      {showUser2 && <RehydrateChild userId={2} />}
      {showPlain && <PlainChild />}
    </div>
  );
}
