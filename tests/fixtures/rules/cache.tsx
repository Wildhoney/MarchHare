/**
 * E2E Test Fixtures for Cache Layer
 *
 * Tests cacheable(), invalidate(), and cache() model initialisation.
 */
import * as React from "react";
import {
  Action,
  Lifecycle,
  useActions,
  Cache,
  cache,
} from "../../../src/library/index.ts";

class CacheOps {
  static Counter = Cache(30_000);
  static User = Cache<{ UserId: number }>(30_000);
}

class CacheActions {
  static Fetch = Action("Fetch");
  static FetchAgain = Action("FetchAgain");
  static Invalidate = Action("Invalidate");
  static FetchUser = Action<number>("FetchUser");
  static InvalidateUser = Action<number>("InvalidateUser");
}

type CacheModel = {
  value: string;
  fetchCount: number;
  userValue: string;
  userFetchCount: number;
};

const initialModel: CacheModel = {
  value: "none",
  fetchCount: 0,
  userValue: "none",
  userFetchCount: 0,
};

let fetchCounter = 0;
let userFetchCounter = 0;

function CacheableTest() {
  const [model, actions] = useActions<CacheModel, typeof CacheActions>(
    initialModel,
  );

  actions.useAction(CacheActions.Fetch, async (context) => {
    fetchCounter++;
    const count = fetchCounter;
    const value = await context.actions.cacheable(
      CacheOps.Counter,
      async (cache) => cache(`fetched-${count}`),
    );

    context.actions.produce(({ model }) => {
      model.value = value;
      model.fetchCount = count;
    });
  });

  actions.useAction(CacheActions.FetchAgain, async (context) => {
    const value = await context.actions.cacheable(
      CacheOps.Counter,
      async (cache) => {
        fetchCounter++;
        return cache(`fetched-${fetchCounter}`);
      },
    );

    context.actions.produce(({ model }) => {
      model.value = value;
    });
  });

  actions.useAction(CacheActions.Invalidate, (context) => {
    context.actions.invalidate(CacheOps.Counter);
    context.actions.produce(({ model }) => {
      model.value = "invalidated";
    });
  });

  actions.useAction(CacheActions.FetchUser, async (context, userId) => {
    userFetchCounter++;
    const count = userFetchCounter;
    const value = await context.actions.cacheable(
      CacheOps.User({ UserId: userId }),
      async (cache) => cache(`user-${userId}-fetch-${count}`),
    );

    context.actions.produce(({ model }) => {
      model.userValue = value;
      model.userFetchCount = count;
    });
  });

  actions.useAction(CacheActions.InvalidateUser, (context, userId) => {
    context.actions.invalidate(CacheOps.User({ UserId: userId }));
  });

  return (
    <div>
      <h3>Cacheable</h3>
      <div data-testid="cache-value">{model.value}</div>
      <div data-testid="cache-fetch-count">{model.fetchCount}</div>
      <div data-testid="cache-user-value">{model.userValue}</div>
      <div data-testid="cache-user-fetch-count">{model.userFetchCount}</div>
      <button
        data-testid="cache-fetch"
        onClick={() => actions.dispatch(CacheActions.Fetch)}
      >
        Fetch
      </button>
      <button
        data-testid="cache-fetch-again"
        onClick={() => actions.dispatch(CacheActions.FetchAgain)}
      >
        Fetch Again
      </button>
      <button
        data-testid="cache-invalidate"
        onClick={() => actions.dispatch(CacheActions.Invalidate)}
      >
        Invalidate
      </button>
      <button
        data-testid="cache-fetch-user-1"
        onClick={() => actions.dispatch(CacheActions.FetchUser, 1)}
      >
        Fetch User 1
      </button>
      <button
        data-testid="cache-fetch-user-2"
        onClick={() => actions.dispatch(CacheActions.FetchUser, 2)}
      >
        Fetch User 2
      </button>
      <button
        data-testid="cache-invalidate-user-1"
        onClick={() => actions.dispatch(CacheActions.InvalidateUser, 1)}
      >
        Invalidate User 1
      </button>
    </div>
  );
}

// Test cache() model initialisation
class InitCacheOps {
  static Greeting = Cache(30_000);
}

class InitActions {
  static Populate = Action("Populate");
  static Mount = Action("Mount");
}

type InitModel = {
  greeting: string;
  status: string;
};

function CacheInitTest() {
  const [showChild, setShowChild] = React.useState(false);
  const [model, actions] = useActions<
    { populated: boolean },
    typeof InitActions
  >({ populated: false });

  actions.useAction(InitActions.Populate, async (context) => {
    await context.actions.cacheable(InitCacheOps.Greeting, async (cache) =>
      cache("Hello from cache"),
    );
    context.actions.produce(({ model }) => {
      model.populated = true;
    });
  });

  return (
    <div>
      <h3>Cache Init</h3>
      <div data-testid="cache-init-populated">
        {model.populated ? "yes" : "no"}
      </div>
      <button
        data-testid="cache-init-populate"
        onClick={() => actions.dispatch(InitActions.Populate)}
      >
        Populate Cache
      </button>
      <button
        data-testid="cache-init-show-child"
        onClick={() => setShowChild(true)}
      >
        Show Child
      </button>
      {showChild && <CacheInitChild />}
    </div>
  );
}

function CacheInitChild() {
  const initModel: InitModel = {
    greeting: cache(InitCacheOps.Greeting, "fallback"),
    status: "mounted",
  };

  const [model] = useActions<InitModel, typeof InitActions>(initModel);

  return (
    <div>
      <div data-testid="cache-init-greeting">{model.greeting}</div>
      <div data-testid="cache-init-status">{model.status}</div>
    </div>
  );
}

export function CacheFixture() {
  return (
    <div data-testid="cache-fixture">
      <CacheableTest />
      <CacheInitTest />
    </div>
  );
}
