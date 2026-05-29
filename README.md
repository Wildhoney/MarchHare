<div align="center">
  <img src="/media/logo-v3.png" width="475" />

<i>❝We're all <ins>mad</ins> here.❞</i>
<br />
<sub><strong>M</strong>odel,</sub>
<sub><strong>A</strong>ctions,</sub>
<sub><strong>D</strong>ata</sub>

[![Checks](https://github.com/Wildhoney/MarchHare/actions/workflows/checks.yml/badge.svg)](https://github.com/Wildhoney/MarchHare/actions/workflows/checks.yml)

</div>

> Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

> **[View Live Demo →](https://wildhoney.github.io/MarchHare/)**

## Contents

1. [Benefits](#benefits)
1. [Getting started](#getting-started)

For advanced topics, see the [recipes directory](./recipes/).

## Benefits

- Event-driven architecture superset of [React](https://react.dev/).
- Views only re-render when the model changes.
- Built-in [optimistic updates](https://medium.com/@kyledeguzmanx/what-are-optimistic-updates-483662c3e171) via [Immertation](https://github.com/Wildhoney/Immertation).
- No stale closures &ndash; `context.data` stays current after `await`.
- No need to lift state &ndash; siblings communicate via events.
- Reduces context proliferation &ndash; events replace many contexts.
- No need to memoize callbacks &ndash; handlers are stable references with fresh closure access.
- Clear separation between business logic and markup.
- Complements [Feature Slice Design](https://feature-sliced.design/) architecture.
- Strongly typed dispatches, models, payloads, etc.
- Built-in request cancellation with `AbortController`.
- Granular async state tracking per model field.
- Declarative lifecycle hooks without `useEffect`.
- Centralised error handling via the global `Lifecycle.Fault` broadcast.
- View-side reactivity for the per-`<Boundary>` Store via the global `Lifecycle.Store` broadcast.
- React Native compatible &ndash; uses [eventemitter3](https://github.com/primus/eventemitter3) for cross-platform pub/sub.

## Getting started

We dispatch the `Actions.Name` event upon clicking the "Sign in" button and within the component we subscribe to that same event via `useContext` so that when it's triggered it updates the model with the payload &ndash; in the React component we render `model.name`. The `With.Update` helper binds the action's payload directly to a model property.

```tsx
import { useContext, Action, With } from "march-hare";

type Model = {
  name: string | null;
};

const model: Model = {
  name: null,
};

export class Actions {
  static Name = Action<string>("Name");
}

function useActions() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Name, With.Update("name"));

  return actions;
}

export default function Profile(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <>
      <p>Hey {model.name}</p>

      <button onClick={() => actions.dispatch(Actions.Name, randomName())}>
        Sign in
      </button>
    </>
  );
}
```

When you need to do more than just assign the payload &ndash; such as making an API request &ndash; expand `useAction` to a full function. It can be synchronous, asynchronous, or even a generator. Remote data goes through `Resource` rather than a bare `fetch` &ndash; declare the resource at module scope, fetch from handlers via `context.actions.resource(...)`:

```ts
// resources.ts
import { Resource } from "march-hare";

export const user = Resource(({ controller }) =>
  ky.get(api.user(), { signal: controller.signal }).json<User>(),
);
```

```tsx
actions.useAction(Actions.Name, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.name = context.actions.annotate(model.name, Op.Update)),
  );

  // Auto-threads context.task.controller and the Store snapshot.
  const data = await context.actions.resource(user());

  context.actions.produce(({ model }) => void (model.name = data.name));
});
```

Notice we're using `annotate` which you can read more about in the [Immertation documentation](https://github.com/Wildhoney/Immertation). Once the request is finished we update the model again with the name fetched from the response and re-render the React component. `Resource` caches the most recent successful payload and exposes typed params &ndash; the full API is covered [further down](#remote-data).

If you need to access external reactive values (like props or `useState` from parent components) that always reflect the latest value even after `await` operations, pass a data callback to `context.useActions`. The same snapshot is exposed as the third tuple element so JSX and handlers read from a single named source:

```tsx
const context = useContext<Model, typeof Actions, { query: string }>();
const actions = context.useActions(
  model,
  () => ({
    query: props.query,
  }),
);

actions.useAction(Actions.Search, async (context) => {
  const results = await context.actions.resource(
    search({ query: context.data.query }),
  );
  // context.data.query is always the latest value, even after await
  console.log(context.data.query, results);
});

return <input value={data.query} onChange={…} />;
```

`data` is read-only from the view side &ndash; handlers read fresh values via `context.data` (Proxy delegating to a ref kept current across `await`s), JSX reads via the third tuple element (the same Proxy, refreshed synchronously each render). If a handler needs to _react_ to a change in `data`, subscribe to `Lifecycle.Update()` &mdash; it fires whenever `getData`'s result differs from the previous render. For more details, see the [referential equality recipe](./recipes/referential-equality.md) and the [React context in handlers recipe](./recipes/react-context-in-handlers.md).

When an external library needs the dispatch callback at construction time (form libraries, animation engines) _and_ its return value must flow back into `context.useActions` via the data callback, there's a chicken-and-egg &mdash; each side wants the other to exist first. `useContext` resolves this by returning a stable handle up-front: `context.actions.dispatch` is callable from the first line, the external library closes over it, and `context.useActions(initialModel, getData?)` completes the binding once the external value is in scope. See the [`useContext` recipe](./recipes/use-context.md) for the full pattern.

The model defaults to `void`, so you can call `context.useActions()` with no generics or initial state when only handlers are needed:

```tsx
import { useContext, Lifecycle } from "march-hare";

class Actions {
  static Mount = Lifecycle.Mount();
}

const context = useContext<void, typeof Actions>();
const actions = context.useActions();

actions.useAction(Actions.Mount, () => {
  console.log("Mounted!");
});
```

If your component doesn't need local state but still needs to dispatch or listen to typed actions, call `context.useActions()` with no initial model. No state is allocated:

```tsx
import { useContext, Action, Lifecycle } from "march-hare";

export class Actions {
  static Ping = Action("Ping");
}

export default function Pinger(): React.ReactElement {
  const context = useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.Ping, () => {
    console.log("Pinged!");
  });

  return <button onClick={() => actions.dispatch(Actions.Ping)}>Ping</button>;
}
```

This is useful for components that only coordinate via events &ndash; forwarding broadcasts, triggering side-effects, or bridging external systems. You can still use lifecycle hooks, `context.data`, and `dispatch` as normal. See the [void model recipe](./recipes/void-model.md) for more details.

Each action should be responsible for managing its own data &ndash; in this case our `Profile` action handles fetching the user but other components may want to consume it &ndash; for that we should use a broadcast action:

```tsx
class BroadcastActions {
  static Name = Action<string>("Name", Distribution.Broadcast);
}

class Actions {
  static Broadcast = BroadcastActions;
  static Profile = Action<string>("Profile");
}
```

```tsx
actions.useAction(Actions.Profile, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.name = context.actions.annotate(model.name, Op.Update)),
  );

  const data = await context.actions.resource(user());

  context.actions.produce(({ model }) => void (model.name = data.name));

  context.actions.dispatch(Actions.Broadcast.Name, data.name);
});
```

Once we have the broadcast action, if we want to listen for it and perform another operation in our local component we can do that via `useAction`:

```tsx
actions.useAction(Actions.Broadcast.Name, async (context, name) => {
  const data = await context.actions.resource(friends({ name }));

  context.actions.produce(({ model }) => void (model.friends = data));
});
```

Both `read` and `peek` access the latest cached broadcast value without subscribing via `useAction`. The difference is that `read` waits for any pending annotations on the corresponding model field to settle before resolving, whereas `peek` returns the value immediately:

```tsx
actions.useAction(Actions.FetchFriends, async (context) => {
  const name = await context.actions.resolution(Actions.Broadcast.Name);
  if (!name) return;
  const data = await context.actions.resource(friends({ name }));
  context.actions.produce(({ model }) => void (model.friends = data));
});
```

`peek` is useful for guard checks or synchronous reads where you don't need to wait for settled state:

```tsx
actions.useAction(Actions.Check, (context) => {
  const name = context.actions.peek(Actions.Broadcast.Name);
  if (!name) return;
  console.log(name);
});
```

Dispatch is awaitable &ndash; `context.actions.dispatch` returns a `Promise<void>` that resolves when all triggered handlers have completed. This prevents UI flashes where local state changes before upstream handlers finish:

```tsx
actions.useAction(Actions.Mount, async (context) => {
  // Wait for all PaymentSent handlers across the app to finish.
  await context.actions.dispatch(Actions.Broadcast.PaymentSent);

  // Safe to update local state now — upstream work is done.
  context.actions.produce(({ model }) => void (model.loading = false));
});
```

Generator handlers are excluded from the await &mdash; they run in the background and do not block the dispatch promise, since they are typically long-lived (polling, SSE streams, etc.).

You can also render broadcast values declaratively in JSX with `actions.stream`. The renderer callback receives `(value, inspect)` and returns React nodes:

```tsx
function Dashboard() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions(initialModel);

  return (
    <div>
      {actions.stream(Actions.Broadcast.User, (user, inspect) => (
        <span>Welcome, {user.name}</span>
      ))}
    </div>
  );
}
```

Components that mount after a broadcast has already been dispatched automatically receive the cached value via their `useAction` handler. If you also fetch data in `Lifecycle.Mount()`, see the [mount deduplication recipe](./recipes/mount-broadcast-deduplication.md) to avoid duplicate requests.

<a id="remote-data"></a>

For remote data, declare a `Resource` at module scope and use it directly. `user(params)` is the unified call form &mdash; it returns the sync cache read (`User | null`) and primes a slot that `context.actions.resource(user(params))` consumes for the fetch path (with auto-threaded abort controller and Store snapshot). Every successful fetch caches the response in a module-level slot keyed by the fetcher and the stringified params, so different param-sets are independent. Keep all resources in `resources.ts` and pull them in with named imports:

```ts
// resources.ts
import { Resource } from "march-hare";

export const user = Resource(({ controller }) =>
  ky.get("/api/user", { signal: controller.signal }).json<User>(),
);

export const pay = Resource<Receipt, Body>(({ controller, params }) =>
  ky
    .post("/api/pay", { json: params, signal: controller.signal })
    .json<Receipt>(),
);
```

```tsx
// actions.ts
import { useContext } from "march-hare";
import { user, pay } from "./resources";

export function useActions() {
  const context = useContext<Model, typeof Actions>();

  const actions = context.useActions({
    // Sync cache read at the model literal — returns null when nothing is cached.
    user: user(),
    receipt: null,
  });

  actions.useAction(Actions.Mount, async (context) => {
    const data = await context.controller
      .resource(user())
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.user = data));
  });

  actions.useAction(Actions.Submit, async (context, body) => {
    const receipt = await context.actions.resource(pay(body));
    context.actions.produce(({ model }) => void (model.receipt = receipt));
  });

  return actions;
}
```

`context.actions.resource(invocation)` returns a thenable. Awaiting it fires the fetch unconditionally; chaining `.exceeds({ minutes: 5 })` short-circuits when the per-params cache age does not yet exceed the supplied freshness window. `.exceeds(duration)` accepts a `Temporal.Duration`, a `DurationLike` object, or an ISO 8601 duration string. `Temporal` is read from the host runtime &ndash; bring a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) if your target environment does not yet expose it natively.

`Resource` takes a single fetcher argument. The fetcher receives `{ store, controller, params }` &mdash; destructure whichever you need. There are no callbacks &ndash; no `onSuccess`, no `onError`, no injected `dispatch`. Side-effects after a run (broadcasting, analytics, model writes) live in the `useAction` handler that awaited the call, next to the rest of the flow:

```ts
export const user = Resource(({ controller }) =>
  ky.get("/api/user", { signal: controller.signal }).json<User>(),
);

actions.useAction(Actions.Mount, async (context) => {
  const data = await context.actions.resource(user());
  await context.actions.dispatch(Actions.Broadcast.UserUpdated, data);
  context.actions.produce(({ model }) => void (model.user = data));
});
```

`params` is the second generic on `Resource` and defaults to `{}`. Declare it when the fetcher needs call-time inputs &ndash; cursors, ids, query strings, request bodies. `params` is a single object (not positional args), which keeps call sites self-documenting:

```ts
type Params = { cursor: string | null };

export const feed = Resource<Page<Item>, Params>(({ controller, params }) =>
  http
    .get("feed", {
      searchParams: { cursor: params.cursor ?? "" },
      signal: controller.signal,
    })
    .json<Page<Item>>(),
);

const page = await context.actions.resource(
  feed({ cursor: context.model.cursor }),
);
```

A complete IntersectionObserver-driven infinite-scroll demo lives at [`src/example/transactions/`](./src/example/transactions/) &ndash; mock paginated API, scroll-triggered `LoadMore`, `pending()` guard, broadcast on success.

For typed failure routing, wrap the call in `try/catch` and use `instanceof` &ndash; TypeScript cannot type promise rejections, so narrowing happens in the handler that catches them:

```ts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await context.actions.resource(user());
    context.actions.produce(({ model }) => void (model.user = data));
  } catch (error) {
    if (error instanceof RateLimitedError) {
      await context.actions.dispatch(
        Actions.Broadcast.RateLimited,
        error.retryAfter,
      );
    }
    throw error;
  }
});
```

See the [Resource recipe](./recipes/use-resource.md) for the three-tier error handling model, parameterised resources, and limitations.

### Persisting resources across reloads

By default a `Resource`'s cache is in-memory only &ndash; it resets on every page load. To keep the most recent successful payload around between sessions, wire a `Cache` instance to the `Resource` definition. The Cache writes through to its adapter on every successful run and seeds the per-params slot from storage on first read, so call sites stay free of explicit `store.set` / `store.get` ceremony.

```ts
// resources.ts
import { Cache, Resource } from "march-hare";

const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const cat = Resource(
  async ({ controller }) => fetchCat(controller.signal),
  cache,
);
```

```ts
// actions.ts
const context = useContext<Model, typeof Actions>();
const actions = context.useActions({
  // First render reads the Cache automatically.
  cat: cat(),
});

actions.useAction(Actions.Mount, async (context) => {
  // Short-circuits when the persisted payload is < 5 minutes old.
  // The Cache writes through automatically on success.
  const fresh = await context.controller
    .resource(cat())
    .exceeds({ minutes: 5 });
  context.actions.produce(({ model }) => void (model.cat = fresh));
});
```

`Cache()` with no adapter is an in-memory scope &ndash; useful in tests or when you want a holdable cache without persistence. Per-params keying via `JSON.stringify(params)` is automatic, so `user({ id: 5 })` and `user({ id: 6 })` are distinct slots.

See the [storage recipe](./recipes/storage.md) for backend adapters (React Native MMKV, browser extension `chrome.storage`), sign-out purge, and the `unset` sentinel that keeps "nothing stored" distinct from "a legitimately stored null".

For targeted event delivery, use channeled actions. Define a controller type as the second generic argument and call the action with a controller object &ndash; handlers fire when the dispatch controller matches:

```tsx
class Actions {
  // Second generic arg defines the controller type
  static UserUpdated = Action<User, { UserId: number }>("UserUpdated");
}

// Subscribe to updates for a specific user
actions.useAction(
  Actions.UserUpdated({ UserId: props.userId }),
  (context, user) => {
    // Only fires when dispatched with matching UserId
  },
);

// Subscribe to all admin user updates
actions.useAction(
  Actions.UserUpdated({ Role: Role.Admin }),
  (context, user) => {
    // Fires for {Role: Role.Admin}, {Role: Role.Admin, UserId: 5}, etc.
  },
);

// Dispatch to specific user
actions.dispatch(Actions.UserUpdated({ UserId: user.id }), user);

// Dispatch to all admin handlers
actions.dispatch(Actions.UserUpdated({ Role: Role.Admin }), user);

// Dispatch to plain action - ALL handlers fire (plain + all channeled)
actions.dispatch(Actions.UserUpdated, user);
```

Channel values support non-nullable primitives: `string`, `number`, `boolean`, or `symbol`. By convention, use uppercase keys like `{UserId: 4}` to distinguish controller keys from payload properties.

For scoped communication between component groups, use multicast actions with the `withScope` HOC. Each multicast action defines its own scope &ndash; pass the same action to `withScope` and to `dispatch`, no separate scope name required:

```tsx
import { Action, Distribution, withScope } from "march-hare";

// Group multicast actions on a class named `Scope`.
class Scope {
  static Update = Action<number>("Update", Distribution.Multicast);
}

class Actions {
  static Increment = Action("Increment");
}

function ScoreArea() {
  return (
    <>
      <ScoreBoard />
      <PlayerList />
    </>
  );
}

// Wrap the subtree where the scope applies.
export default withScope(Scope.Update, ScoreArea);

// Dispatch to every component inside the scope.
actions.dispatch(Scope.Update, 42);
```

Unlike broadcast which reaches all mounted components, multicast is confined to the wrapped subtree &ndash; perfect for isolated widget groups, form sections, or distinct UI regions. Like broadcast, multicast caches dispatched values per scope &ndash; components that mount later automatically receive the cached value. See the [mount deduplication recipe](./recipes/mount-broadcast-deduplication.md) if you also fetch data in `Lifecycle.Mount()`.

See the [multicast recipe](./recipes/multicast-actions.md) for more details.

For coordinating between async handlers and threading ambient values (session tokens, locale, feature flags, current operational mode) without re-rendering the JSX tree on every dot read, use the per-`<Boundary>` `Store`. Declare your app's Store shape once via module augmentation, supply the initial value to `<Boundary store={...}>`, read via dot notation (`store.session`, `context.store.locale`), and write via `context.actions.produce(({ store }) => { ... })` &mdash; the same Immer-style recipe used for the model. Every `Resource` fetcher also receives a snapshot of the Store on its args object. When the view side needs to react to Store changes, subscribe to the global `Lifecycle.Store` broadcast &mdash; `actions.useAction(Lifecycle.Store, handler)` for handler-level work and `actions.stream(Lifecycle.Store, (store) => ...)` for JSX. Both seed from the initial Store on mount.

```ts
import { useContext } from "march-hare";

// Declare your Store's shape once. Every read/write is typed against this.
declare module "march-hare" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Store {
    session: Session | null;
    operating: "idle" | "signing-out";
  }
}

// Wire the initial Store into Boundary at app root.
<Boundary store={{ session: null, operating: "idle" }}>
  <App />
</Boundary>;

export function useAuthActions() {
  const context = useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.SignOut, async (context) => {
    context.actions.produce(({ store }) => {
      store.operating = "signing-out";
    });
    await api.signOut();
    context.actions.produce(({ store }) => {
      store.session = null;
      store.operating = "idle";
    });
  });

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.store.operating === "signing-out") return;
    // ...
  });

  return actions;
}
```

Toggling boolean UI state &ndash; modals, sidebars, drawers &ndash; is one of the most common patterns. Bind a unicast action to a boolean field on the model with `With.Invert`:

```tsx
import { useContext, Action, With } from "march-hare";

type Model = {
  paymentDialog: boolean;
  sidebar: boolean;
};

export class Actions {
  static TogglePaymentDialog = Action("TogglePaymentDialog");
  static ToggleSidebar = Action("ToggleSidebar");
}

const context = useContext<Model, typeof Actions>();
const actions = context.useActions({
  paymentDialog: false,
  sidebar: false,
});

actions.useAction(Actions.TogglePaymentDialog, With.Invert("paymentDialog"));
actions.useAction(Actions.ToggleSidebar, With.Invert("sidebar"));

// Dispatch from anywhere with access to the actions object.
actions.dispatch(Actions.TogglePaymentDialog);

{
  model.paymentDialog && <PaymentDialog />;
}
```

`With.Invert` only compiles when the named property is a boolean on the model. `With.Update("name")` works the same way for arbitrary fields, and the payload type must match `model[name]`.
