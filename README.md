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
1. [Async resources](#async-resources)
1. [Reactive data](#reactive-data)
1. [Broadcast actions](#broadcast-actions)
1. [Remote data with `Resource`](#remote-data-with-resource)
1. [Channeled actions](#channeled-actions)
1. [Multicast actions](#multicast-actions)
1. [Global data](#global-data)
1. [Toggling boolean state](#toggling-boolean-state)

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
- View-side reactivity for the per-`<app.Boundary>` Env via the global `Lifecycle.Env` broadcast.
- React Native compatible &ndash; uses [eventemitter3](https://github.com/primus/eventemitter3) for cross-platform pub/sub.

## Getting started

Declare your app once via `App()` &ndash; the returned handle is the entrypoint for every typed primitive: `app.Boundary`, `app.useContext`, `app.useEnv`, `app.Resource`. Render `<app.Boundary>` once at the root and import `app` wherever you need it. Pass `{ env }` only when your app needs ambient state ([see Global data below](#global-data)):

```ts
// app.ts
import { App } from "march-hare";

export const app = App();
```

```tsx
// index.tsx
import { app } from "./app";

<app.Boundary>
  <Root />
</app.Boundary>;
```

Inside a feature, define the model + actions, write a `useActions` hook that wires handlers, and destructure `[model, actions]` from it in the component. We dispatch the `Actions.Name` event on click, subscribe to it via `app.useContext`, and `With.Update` binds the payload directly to a model property:

```tsx
import { Action, With } from "march-hare";
import { app } from "./app";

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
  const context = app.useContext<Model, typeof Actions>();
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

This shape &ndash; `useActions` hook, `[model, actions]` destructure in the component &ndash; is the canonical pattern used throughout this README.

## Async resources

When the handler needs to do more than assign the payload &ndash; an API call, for example &ndash; expand `useAction` to a full function. Remote data goes through `app.Resource` rather than a bare `fetch`: declare the resource at module scope, fetch via `context.actions.resource(...)`:

```ts
// resources.ts
import { app } from "./app";

export const user = app.Resource<User>((context) =>
  ky.get(api.user(), { signal: context.controller.signal }).json<User>(),
);
```

```tsx
import { Action, Op } from "march-hare";
import { app } from "./app";
import * as resource from "./resources";

type Model = { name: string | null };
const model: Model = { name: null };

export class Actions {
  static Name = Action<string>("Name");
}

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Name, async (context) => {
    context.actions.produce(
      ({ model }) =>
        void (model.name = context.actions.annotate(model.name, Op.Update)),
    );

    // Auto-threads context.task.controller and the live Env handle.
    const user = await context.actions.resource(resource.user());

    context.actions.produce(({ model }) => void (model.name = user.name));
  });

  return actions;
}

export default function Profile(): React.ReactElement {
  const [model, actions] = useActions();
  return <p>Hey {model.name}</p>;
}
```

`annotate` is covered in the [Immertation documentation](https://github.com/Wildhoney/Immertation). Once the request resolves we update the model again with the fetched name. `app.Resource` caches the most recent successful payload and exposes typed params &ndash; the full API is covered [further down](#remote-data-with-resource).

## Reactive data

If you need to access external reactive values (props or `useState` from parent components) that always reflect the latest value even after `await` operations, pass a data callback as the second argument to `context.useActions`. The same snapshot is exposed as the third tuple element so JSX and handlers read from a single named source:

```tsx
import { Action } from "march-hare";
import { app } from "./app";
import * as resource from "./resources";

type Model = { results: Result[] };
const model: Model = { results: [] };

type Props = { query: string };

export class Actions {
  static Search = Action<string>("Search");
}

function useActions(props: Props) {
  const context = app.useContext<Model, typeof Actions, Props>();
  const actions = context.useActions(model, () => ({ query: props.query }));

  actions.useAction(Actions.Search, async (context) => {
    const search = await context.actions.resource(
      resource.search({ query: context.data.query }),
    );
    // context.data.query is always the latest value, even after await.
    context.actions.produce(({ model }) => void (model.results = search));
  });

  return actions;
}

export default function Search(props: { query: string }): React.ReactElement {
  const [, actions, data] = useActions(props);

  return (
    <input
      value={data.query}
      onChange={(event) => actions.dispatch(Actions.Search, event.target.value)}
    />
  );
}
```

`data` is read-only from the view side &ndash; handlers read fresh values via `context.data` (Proxy delegating to a ref kept current across `await`s); JSX reads via the third tuple element (the same Proxy, refreshed synchronously each render). If a handler needs to _react_ to a change in `data`, subscribe to `Lifecycle.Update()` &mdash; it fires whenever `getData`'s result differs from the previous render. See the [referential equality recipe](./recipes/referential-equality.md) and the [React context in handlers recipe](./recipes/react-context-in-handlers.md) for more.

When an external library needs the dispatch callback at construction time (form libraries, animation engines) _and_ its return value must flow back into `context.useActions` via the data callback, there's a chicken-and-egg &mdash; each side wants the other to exist first. `app.useContext` resolves this by returning a stable handle up-front: `context.actions.dispatch` is callable from the first line, the external library closes over it, and `context.useActions(initialModel, getData?)` completes the binding once the external value is in scope:

```tsx
import { Action } from "march-hare";
import { app } from "./app";
import * as resource from "./resources";
import { useForm } from "some-form-library";

type Model = { saving: boolean };

export class Actions {
  static Submit = Action("Submit");
}

function useActions() {
  // 1. The handle is ready immediately — `context.actions.dispatch` is callable
  //    before `context.useActions(...)` runs.
  const context = app.useContext<Model, typeof Actions, { form: FormApi }>();

  // 2. The external library closes over `context.actions.dispatch` at
  //    construction time. The form's `onSubmit` fires a Submit action.
  const form = useForm({
    onSubmit: () => void context.actions.dispatch(Actions.Submit),
  });

  // 3. The form value (`form`) flows back into the data callback so handlers
  //    read it via `context.data.form`.
  const actions = context.useActions({ saving: false }, () => ({ form }));

  actions.useAction(Actions.Submit, async (context) => {
    context.actions.produce(({ model }) => void (model.saving = true));
    await context.actions.resource(resource.save(context.data.form.values));
    context.actions.produce(({ model }) => void (model.saving = false));
  });

  return actions;
}
```

See the [`useContext` recipe](./recipes/use-context.md) for the full pattern.

The model defaults to `void`, so a component that only coordinates via events &mdash; forwarding broadcasts, triggering side-effects, bridging external systems &mdash; can call `context.useActions()` with no initial model:

```tsx
import { Action } from "march-hare";
import { app } from "./app";

export class Actions {
  static Ping = Action("Ping");
}

function useActions() {
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.Ping, () => {
    console.log("Pinged!");
  });

  return actions;
}

export default function Pinger(): React.ReactElement {
  const [, actions] = useActions();
  return <button onClick={() => actions.dispatch(Actions.Ping)}>Ping</button>;
}
```

You can still use lifecycle hooks, `context.data`, and `dispatch` as normal. See the [void model recipe](./recipes/void-model.md) for more.

## Broadcast actions

Each action should be responsible for its own data &mdash; in the `Profile` example above, the handler fetches the user but other components may want to consume the result. For that, use a broadcast action:

```ts
// actions.ts (excerpt)
import { Action, Distribution } from "march-hare";

class BroadcastActions {
  static Name = Action<string>("Name", Distribution.Broadcast);
}

export class Actions {
  static Broadcast = BroadcastActions;
  static Profile = Action<string>("Profile");
}
```

Inside `useActions`, the handler fetches the user and then dispatches the broadcast so siblings see the result:

```ts
actions.useAction(Actions.Profile, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.name = context.actions.annotate(model.name, Op.Update)),
  );

  const user = await context.actions.resource(resource.user());

  context.actions.produce(({ model }) => void (model.name = user.name));

  context.actions.dispatch(Actions.Broadcast.Name, user.name);
});
```

Any component whose `useActions` subscribes to the broadcast receives it:

```ts
actions.useAction(Actions.Broadcast.Name, async (context, name) => {
  const friends = await context.actions.resource(resource.friends({ name }));
  context.actions.produce(({ model }) => void (model.friends = friends));
});
```

`context.actions.final(...)` and `context.actions.peek(...)` access the latest cached broadcast value without subscribing via `useAction`. `final` waits for any pending annotations on the corresponding model field to settle; `peek` returns immediately:

```ts
actions.useAction(Actions.FetchFriends, async (context) => {
  const name = await context.actions.final(Actions.Broadcast.Name);
  if (!name) return;
  const friends = await context.actions.resource(resource.friends({ name }));
  context.actions.produce(({ model }) => void (model.friends = friends));
});

actions.useAction(Actions.Check, (context) => {
  const name = context.actions.peek(Actions.Broadcast.Name);
  if (!name) return;
  console.log(name);
});
```

Dispatch is awaitable &ndash; `context.actions.dispatch` returns a `Promise<void>` that resolves when every triggered handler has completed. This prevents UI flashes where local state changes before upstream handlers finish:

```ts
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
import { app } from "./app";

type Model = {
  /* ... */
};
const model: Model = {
  /* ... */
};

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);
  return actions;
}

export default function Dashboard(): React.ReactElement {
  const [, actions] = useActions();

  return (
    <div>
      {actions.stream(Actions.Broadcast.User, (user) => (
        <span>Welcome, {user.name}</span>
      ))}
    </div>
  );
}
```

Components that mount after a broadcast has already been dispatched automatically receive the cached value via their `useAction` handler. If you also fetch data in `Lifecycle.Mount()`, see the [mount deduplication recipe](./recipes/mount-broadcast-deduplication.md) to avoid duplicate requests.

## Remote data with `Resource`

For remote data, declare an `app.Resource` at module scope. `resource.user(params)` is the unified call form &mdash; it returns the sync cache read (`User | null`) and primes a slot that `context.actions.resource(resource.user(params))` consumes for the fetch path (with auto-threaded abort controller and a live handle to the per-`<Boundary>` Env). Every successful fetch caches the response in a module-level slot keyed by the fetcher and the stringified params, so different param-sets are independent. Keep all resources in `resources.ts` and pull the whole module in as a namespace (`import * as resource from "./resources"`):

```ts
// resources.ts
import { app } from "./app";

export const user = app.Resource<User>((context) =>
  ky.get("/api/user", { signal: context.controller.signal }).json<User>(),
);

export const pay = app.Resource<Receipt, Body>((context) =>
  ky
    .post("/api/pay", {
      json: context.params,
      signal: context.controller.signal,
    })
    .json<Receipt>(),
);
```

```tsx
// profile/actions.ts
import { Action, Lifecycle, type Maybe } from "march-hare";
import { app } from "../app";
import * as resource from "../resources";

type Model = { user: Maybe<User>; receipt: Maybe<Receipt> };

export class Actions {
  static Mount = Lifecycle.Mount();
  static Submit = Action<Body>("Submit");
}

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({
    // Sync cache read at the model literal — returns null when nothing is cached.
    user: resource.user(),
    receipt: null,
  });

  actions.useAction(Actions.Mount, async (context) => {
    const user = await context.actions
      .resource(resource.user())
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.user = user));
  });

  actions.useAction(Actions.Submit, async (context, body) => {
    const pay = await context.actions.resource(resource.pay(body));
    context.actions.produce(({ model }) => void (model.receipt = pay));
  });

  return actions;
}

export default function Profile(): React.ReactElement {
  const [model, actions] = useActions();
  // ...
}
```

`context.actions.resource(invocation)` returns a chainable thenable:

- `.exceeds({ minutes: 5 })` &mdash; short-circuits when the per-params cache age is within the freshness window. Accepts a `Temporal.Duration`, a `DurationLike` object, or an ISO 8601 duration string. `Temporal` is read from the host runtime &ndash; bring a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) if your target doesn't expose it natively.
- `.coalesce()` &mdash; opts the call into in-flight sharing. Any other caller with the same Resource and same structural params receives the same promise. The shared fetch uses a detached `AbortController` so a single caller's abort never cancels work other callers are waiting on; each caller still sees its own `context.task.controller` abort as a rejection of its personal await.

```ts
// Mount and a broadcast handler both fire on mount — only one network request.
actions.useAction(Actions.Mount, async (context) => {
  const user = await context.actions.resource(resource.user()).coalesce();
  context.actions.produce(({ model }) => void (model.user = user));
});

actions.useAction(Actions.Broadcast.UserId, async (context, id) => {
  const user = await context.actions.resource(resource.user({ id })).coalesce();
  context.actions.produce(({ model }) => void (model.user = user));
});
```

For finer-grained control &mdash; separating concurrent fetches into distinct coalesce groups via a token argument &mdash; see the [coalesce tokens recipe](./recipes/coalesce-tokens.md).

The fetcher receives a `context` object &mdash; read fields via `context.env`, `context.controller`, `context.params`. There are no callbacks &ndash; no `onSuccess`, no `onError`. The `context.dispatch` field can fire broadcast or multicast actions from inside the fetcher (unicast is rejected at compile time), but most side-effects (model writes, analytics) belong in the `useAction` handler that awaited the call:

```ts
// resources.ts
export const user = app.Resource<User>(async (context) => {
  const data = await ky
    .get("/api/user", { signal: context.controller.signal })
    .json<User>();
  await context.dispatch(Actions.Broadcast.UserUpdated, data);
  return data;
});
```

`params` is the second generic on `app.Resource` and defaults to `{}`. Declare it when the fetcher needs call-time inputs &ndash; cursors, ids, query strings, request bodies:

```ts
type Params = { cursor: string | null };

export const feed = app.Resource<Page<Item>, Params>((context) =>
  http
    .get("feed", {
      searchParams: { cursor: context.params.cursor ?? "" },
      signal: context.controller.signal,
    })
    .json<Page<Item>>(),
);
```

```ts
// Inside useActions:
actions.useAction(Actions.LoadMore, async (context) => {
  const feed = await context.actions.resource(
    resource.feed({ cursor: context.model.cursor }),
  );
  // ...
});
```

A complete IntersectionObserver-driven infinite-scroll demo lives at [`src/example/transactions/`](./src/example/transactions/) &ndash; mock paginated API, scroll-triggered `LoadMore`, `pending()` guard, broadcast on success.

For typed failure routing, wrap the call in `try/catch` and use `instanceof` &ndash; TypeScript cannot type promise rejections, so narrowing happens in the handler that catches them:

```ts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const user = await context.actions.resource(resource.user());
    context.actions.produce(({ model }) => void (model.user = user));
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

By default an `app.Resource`'s cache is in-memory only &ndash; it resets on every page load. To keep the most recent successful payload around between sessions, switch to `app.Resource.Cachable(cache, fetcher)`. The cache is the **first** argument &mdash; persistence is the headline of this form, the fetcher is the operation. Every successful fetch writes through to the Cache; first reads via the call form auto-seed from the Cache's adapter:

```ts
// resources.ts
import { Cache } from "march-hare";
import { app } from "./app";

const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const cat = app.Resource.Cachable(cache, (context) =>
  fetchCat(context.controller.signal),
);
```

```tsx
// cats/actions.ts
import { Lifecycle, type Maybe } from "march-hare";
import { app } from "../app";
import * as resource from "../resources";

type Model = { cat: Maybe<Cat> };

export class Actions {
  static Mount = Lifecycle.Mount();
}

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({
    // First render reads the Cache automatically.
    cat: resource.cat(),
  });

  actions.useAction(Actions.Mount, async (context) => {
    // Short-circuits when the persisted payload is < 5 minutes old.
    // The Cache writes through automatically on success.
    const cat = await context.actions
      .resource(resource.cat())
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.cat = cat));
  });

  return actions;
}

export default function CatCard(): React.ReactElement {
  const [model] = useActions();
  return model.cat ? <img src={model.cat.url} /> : null;
}
```

`Cache()` with no adapter is an in-memory scope &ndash; useful in tests or when you want a holdable cache without persistence. Per-params keying via `JSON.stringify(params)` is automatic, so `user({ id: 5 })` and `user({ id: 6 })` are distinct slots.

See the [storage recipe](./recipes/storage.md) for backend adapters (React Native MMKV, browser extension `chrome.storage`), sign-out purge, and the `unset` sentinel that keeps "nothing stored" distinct from "a legitimately stored null".

## Channeled actions

For targeted event delivery, use channeled actions. Define a controller type as the second generic argument and call the action with a controller object &ndash; handlers fire only when the dispatch controller matches:

```tsx
import { Action } from "march-hare";
import { app } from "./app";

export class Actions {
  // Second generic arg defines the controller type.
  static UserUpdated = Action<User, { UserId: number }>("UserUpdated");
}

function useActions(props: { userId: number }) {
  const context = app.useContext<Model, typeof Actions, { userId: number }>();
  const actions = context.useActions(model, () => ({ userId: props.userId }));

  // Subscribe to updates for a specific user.
  actions.useAction(
    Actions.UserUpdated({ UserId: props.userId }),
    (context, user) => {
      // Only fires when dispatched with matching UserId.
    },
  );

  return actions;
}

// Dispatch to specific user.
actions.dispatch(Actions.UserUpdated({ UserId: user.id }), user);

// Dispatch to plain action — ALL handlers fire (plain + all channeled).
actions.dispatch(Actions.UserUpdated, user);
```

Channel values support non-nullable primitives: `string`, `number`, `boolean`, or `symbol`. By convention, use uppercase keys like `{UserId: 4}` to distinguish controller keys from payload properties.

## Multicast actions

For scoped communication between component groups, declare a multicast action class and open a scope via `app.Scope<typeof MulticastActions>()`. The generic carries the multicast surface at the type level &mdash; `scope.useContext().actions.dispatch` widens to include those actions on top of the local `Actions` class, the same way `Actions.Broadcast = BroadcastActions` widens for broadcasts. Render `<scope.Boundary>` once at the root of the subtree the scope governs:

```ts
// scope/types.ts — multicast action class, kept separate from the local Actions.
import { Action, Distribution } from "march-hare";

export class MulticastActions {
  static Update = Action<number>("Update", Distribution.Multicast);
}
```

```tsx
// scope/index.tsx — open the scope once.
import { app } from "../app";
import type { MulticastActions } from "./types";
import ScoreBoard from "./components/score-board";
import PlayerList from "./components/player-list";

export const scope = app.Scope<typeof MulticastActions>();

export default function ScoreArea(): React.ReactElement {
  return (
    <scope.Boundary>
      <ScoreBoard />
      <PlayerList />
    </scope.Boundary>
  );
}
```

```tsx
// scope/components/score-board/actions.ts — subscribe and dispatch from inside.
import { Action } from "march-hare";
import { scope } from "../../index";
import { MulticastActions } from "../../types";

type Model = { score: number };

// Like `Broadcast`, you also list the multicast surface on the local
// Actions class so the bound dispatch sees it on `Actions.Multicast.*`.
export class Actions {
  static Multicast = MulticastActions;
  static Increment = Action("Increment");
}

export function useActions() {
  const context = scope.useContext<Model, typeof Actions>();
  const actions = context.useActions({ score: 0 });

  actions.useAction(MulticastActions.Update, (context, score) => {
    context.actions.produce(({ model }) => void (model.score = score));
  });

  actions.useAction(Actions.Increment, (context) => {
    context.actions.dispatch(MulticastActions.Update, context.model.score + 1);
  });

  return actions;
}
```

A few rules worth knowing:

- **Scope is confined to the subtree.** Multicast dispatches inside `<scope.Boundary>` reach every subscriber inside the same boundary, and only those subscribers. Sibling boundaries don't see each other; nothing outside any boundary sees them either.
- **Nesting shadows.** `<scope.Boundary>` is a React context provider, so an inner boundary fully shadows an outer one for its subtree. If you need a single scope to dispatch actions from multiple multicast classes, declare them as a union at the call site &mdash; e.g. `app.Scope<typeof PaymentMulticast | typeof RoomMulticast>()`.
- **No `scope.Scope()`.** The handle deliberately omits a nested factory. Open another scope by calling `app.Scope<...>()` again and rendering its `<Boundary>` &mdash; that way the multicast surface stays declared at the call site.
- **Replay on late-mount is per-scope.** Like broadcast, multicast caches its most recent payload per action symbol; components that mount later inside the same boundary pick up the cached value through their `useAction` handler. See the [mount deduplication recipe](./recipes/mount-broadcast-deduplication.md) if you also fetch in `Lifecycle.Mount()`.

See the [multicast recipe](./recipes/multicast-actions.md) for more details.

## Global data

For coordinating between async handlers and threading ambient values (session tokens, locale, feature flags, current operational mode) without re-rendering the JSX tree on every dot read, use the per-`<app.Boundary>` `Env`. Declare your env shape inline on `App({ env })`, read via dot notation (`env.session`, `context.env.locale`), and write via `context.actions.produce(({ env }) => { ... })` &mdash; the same Immer-style recipe used for the model. Every `app.Resource` fetcher also receives a live read-only handle to the Env on its args object &mdash; the same `Proxy` as `context.env`, so dot reads stay fresh across `await` boundaries inside the fetcher. When the view side needs to react to Env changes, subscribe to the global `Lifecycle.Env` broadcast &mdash; `actions.useAction(Lifecycle.Env, handler)` for handler-level work and `actions.stream(Lifecycle.Env, (env) => ...)` for JSX. Both seed from the initial Env on mount.

```ts
// app.ts
import { App, type Maybe } from "march-hare";

export const app = App({
  env: {
    session: null as Maybe<Session>,
    operating: "idle" as "idle" | "signing-out",
  },
});
```

```ts
// auth/actions.ts — every read/write is typed against the App's env shape.
import { Action } from "march-hare";
import { app } from "../app";

export class Actions {
  static SignOut = Action("SignOut");
  static Refresh = Action("Refresh");
}

function useActions() {
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.SignOut, async (context) => {
    context.actions.produce(({ env }) => {
      env.operating = "signing-out";
    });
    await api.signOut();
    context.actions.produce(({ env }) => {
      env.session = null;
      env.operating = "idle";
    });
  });

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.env.operating === "signing-out") return;
    // ...
  });

  return actions;
}
```

For the view side, render against `Lifecycle.Env` with `actions.stream` &mdash; the renderer receives the latest Env snapshot and re-runs whenever a `produce(({ env }) => ...)` mutation lands:

```tsx
import { Lifecycle } from "march-hare";
import { app } from "./app";

export class Actions {}

function useActions() {
  const context = app.useContext<void, typeof Actions>();
  return context.useActions();
}

export default function Header(): React.ReactElement {
  const [, actions] = useActions();

  return (
    <header>
      {actions.stream(Lifecycle.Env, (env) =>
        env.session ? (
          <span>Hi, {env.session.user.name}</span>
        ) : (
          <span>Signed out</span>
        ),
      )}
    </header>
  );
}
```

`Lifecycle.Env` seeds with the initial Env on mount, so late-mounting components paint the current value immediately instead of flashing through a null state. Pair `actions.stream` with `actions.useAction(Lifecycle.Env, ...)` when a handler-side reaction is also required.

Multiple `App` instances can coexist in the same tree &mdash; each `<app.Boundary>` owns its own Env with its own type.

## Toggling boolean state

Toggling boolean UI state &ndash; modals, sidebars, drawers &ndash; is one of the most common patterns. Bind a unicast action to a boolean field on the model with `With.Invert`:

```tsx
import { Action, With } from "march-hare";
import { app } from "./app";

type Model = {
  paymentDialog: boolean;
  sidebar: boolean;
};

const model: Model = {
  paymentDialog: false,
  sidebar: false,
};

export class Actions {
  static TogglePaymentDialog = Action("TogglePaymentDialog");
  static ToggleSidebar = Action("ToggleSidebar");
}

function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.TogglePaymentDialog, With.Invert("paymentDialog"));
  actions.useAction(Actions.ToggleSidebar, With.Invert("sidebar"));

  return actions;
}

export default function Shell(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <>
      <button onClick={() => actions.dispatch(Actions.TogglePaymentDialog)}>
        Pay
      </button>
      {model.paymentDialog && <PaymentDialog />}
    </>
  );
}
```

`With.Invert` only compiles when the named property is a boolean on the model. `With.Update("name")` works the same way for arbitrary fields, and the payload type must match `model[name]`.
