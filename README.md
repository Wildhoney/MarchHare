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
1. [Resource handling](#resource-handling)
1. [Channeled actions](#channeled-actions)
1. [Multicast actions](#multicast-actions)
1. [Server-sent events](#server-sent-events)
1. [Global data](#global-data)
1. [Reusable components](#reusable-components)
1. [Scaffolding CLI](#scaffolding-cli)

For advanced topics, see the [recipes directory](./recipes/). For a worked end-to-end example with the FSD layout, see [`src/example/`](./src/example/README.md). To scaffold a new project that mirrors that example, see [`src/cli/`](./src/cli/README.md).

## Benefits

- Event-driven architecture superset of [React](https://react.dev/).
- Views only re-render when the model changes.
- Built-in [optimistic updates](https://medium.com/@kyledeguzmanx/what-are-optimistic-updates-483662c3e171) via [Immertation](https://github.com/Wildhoney/Immertation).
- No stale closures &ndash; `context.data` stays current after `await`.
- No need to lift state &ndash; siblings communicate via events.
- Reduces context proliferation &ndash; events replace many contexts.
- No need to memoize callbacks &ndash; handlers are stable references with fresh closure access.
- Clear separation between business logic and markup.
- Complements [Feature Sliced Design](https://feature-sliced.design/) architecture &mdash; **App = host, Scope = feature**; see [Reusable components](#reusable-components).
- Strongly typed dispatches, models, payloads, etc.
- Built-in request cancellation with `AbortController`.
- Granular async state tracking per model field.
- Declarative lifecycle hooks without `useEffect`.
- Centralised error handling via the global `Lifecycle.Fault` broadcast.
- View-side reactivity for the per-`<app.Boundary>` Env via the global `Lifecycle.Env` broadcast.
- Observability hook via `App({ tap })` &ndash; fires for every handler dispatch and its terminal (`success` or `error`). See the [tap recipe](./recipes/tap.md).
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

Inside a feature, define the model + actions, write a `useActions` hook that wires handlers, and destructure `[model, actions]` from it in the component. `With.Update` binds the payload directly to a model property:

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

This shape &ndash; `useActions` hook, `[model, actions]` destructure in the component &ndash; is the canonical pattern throughout this README.

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

`annotate` is covered in the [Immertation documentation](https://github.com/Wildhoney/Immertation). `app.Resource` caches the most recent successful payload and exposes typed params &ndash; the full API is covered [further down](#resource-handling).

## Reactive data

To access external reactive values (props or `useState` from parent components) that stay current even after `await`, pass a data callback as the second argument to `context.useActions`. The same snapshot is exposed as the third tuple element so JSX and handlers read from a single named source:

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

`data` is read-only from the view side &ndash; handlers read fresh values via `context.data` (Proxy delegating to a ref kept current across `await`s); JSX reads via the third tuple element (the same Proxy, refreshed synchronously each render). If a handler needs to _react_ to a change in `data`, subscribe to `Lifecycle.Update()` &mdash; it fires once on mount with the initial data, then whenever `getData`'s result differs from the previous render. See the [referential equality recipe](./recipes/referential-equality.md) and the [React context in handlers recipe](./recipes/react-context-in-handlers.md) for more.

To run a handler when a **single external value** changes &ndash; a React Query result, a prop, a store selector &ndash; declare a `Lifecycle.Reactive<T>()` action and bind the value at the `useAction` site by calling it: `actions.useAction(Actions.User(user), handler)`. The handler fires through the full dispatch pipeline (task, abort signal, taps, faults) whenever the bound value changes by `Object.is`, and once on mount with the current value (defined or `undefined`). See the [reactive values recipe](./recipes/reactive-values.md) for the React Query bridge, firing semantics, and the whole-app broadcast pattern.

When an external library needs the dispatch callback at construction time (form libraries, animation engines) _and_ its return value must flow back into `context.useActions` via the data callback, there's a chicken-and-egg. `app.useContext` resolves this by returning a stable handle up-front: `context.actions.dispatch` is callable from the first line, the external library closes over it, and `context.useActions(initialModel, getData?)` completes the binding once the external value is in scope:

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

See the [`app.useContext` recipe](./recipes/use-controller.md) for the full pattern.

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

The handler fetches the user, then dispatches the broadcast so siblings see the result:

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

## Resource handling

For remote data, declare an `app.Resource` at module scope. The resulting handle has three call forms:

- `resource.user.get(params)` &mdash; synchronous cache read, returns `User | null`. Use it in model literals, JSX, or anywhere you need the cached value without triggering a fetch.
- `resource.user(params)` &mdash; produces an `Invocation` you pass to `context.actions.resource(...)` for the fetch path (with auto-threaded abort controller and a live handle to the per-`<Boundary>` Env).
- `resource.user.action(partial?)` &mdash; broadcast channeled action fired automatically after every successful fetch **and after every eviction**. Payload type is `User | null`: successful fetches broadcast the resolved payload, `.evict(...)` and `.nuke(...)` broadcast `null` with the evicted params as the channel. Always invoke (`resource.user.action()`) before passing to `actions.useAction` or `actions.stream`; supply a subset of params to narrow the filter (more keys = stricter), or pass nothing to receive every event. Errors do not broadcast.

Every successful fetch caches the response in a module-level slot keyed by the fetcher and the stringified params, so different param-sets are independent. Keep all resources in `resources.ts` and pull the whole module in as a namespace (`import * as resource from "./resources"`):

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
    user: resource.user.get(),
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

Any component &mdash; even one that never called the fetcher &mdash; can react to these auto-broadcasts via `actions.useAction` or render the latest payload with `actions.stream`. Call `.action()` with no arguments to match every event on the resource, or supply a subset of params to narrow the filter:

```tsx
// greeting/actions.ts
import { G } from "@mobily/ts-belt";
import { app } from "../app";
import * as resource from "../resources";

type Model = { greeting: string | null };

function useActions() {
  const context = app.useContext<Model>();
  const actions = context.useActions({ greeting: null });

  actions.useAction(resource.user.action(), (context, user) => {
    context.actions.produce(({ model }) => {
      model.greeting = G.isNull(user) ? null : `Welcome, ${user.name}`;
    });
  });

  return actions;
}

export default function Greeting() {
  const [model] = useActions();
  return <span>{model.greeting ?? "…"}</span>;
}
```

Or render the most recent payload declaratively without a local model field:

```tsx
{
  actions.stream(resource.user.action(), (user) => (
    <span>{user?.name ?? "…"}</span>
  ));
}
```

The broadcast cache is sharded by `(action, channel)`, so a late-mounting subscriber replays every cached entry whose channel satisfies its filter &mdash; a `stream` panel that mounts after the page's data has already loaded still paints with the cached value (or `null`, if the slot has been evicted) rather than waiting for the next fetch.

`context.actions.resource(invocation)` returns a chainable thenable:

- `.exceeds({ minutes: 5 })` &mdash; short-circuits when the per-params cache age is within the freshness window. Accepts a `Temporal.Duration`, a `DurationLike` object, or an ISO 8601 duration string. `Temporal` is read from the host runtime &ndash; bring a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) if your target doesn't expose it natively.
- `.isolated()` &mdash; opts this call out of the default `(Resource, params)` coalesce path. Fires an independent network request against the caller's own `context.task.controller`. Reach for it only when two callers genuinely need parallel fetches with byte-identical params; the default is almost always what you want.

By default, concurrent callers with the same `(Resource, params)` share a single in-flight fetch &mdash; one network request, every caller resolves with the same payload. The shared fetch runs on a detached `AbortController` so one caller's abort never cancels work other callers are still waiting on; when every caller has released the shared controller is aborted too, so the network gets cancelled rather than orphaned.

```ts
// Mount and a broadcast handler both fire on mount — only one network request.
actions.useAction(Actions.Mount, async (context) => {
  const user = await context.actions.resource(resource.user());
  context.actions.produce(({ model }) => void (model.user = user));
});

actions.useAction(Actions.Broadcast.UserId, async (context, id) => {
  const user = await context.actions.resource(resource.user({ id }));
  context.actions.produce(({ model }) => void (model.user = user));
});
```

The dedupe key is `(Resource, params)`. Two callers with different params (`{ id: 5 }` vs. `{ id: 6 }`) never share &mdash; they hash to different slots and fire independent requests. If you ever need two parallel calls with byte-identical params (vanishingly rare, almost always a smell that the params should differ), chain `.isolated()`.

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

Declaring a Resource with **no fetcher** yields a **local resource** &mdash; the same per-params cache, sync `.get(params)`, `.action()` auto-broadcast, eviction, and persistence machinery, but with the app as the only writer. Values enter through `.set(value)` on the handler chain, which writes the cache slot and then fires the broadcast with the call params as the channel &mdash; exactly the sequence a successful fetch performs. The rule is one write path per variant: a fetched Resource is only ever written by its fetcher (there is no `.set()` on it), a local Resource only ever by `.set(...)` &mdash; and local invocations are not awaitable, so `.exceeds(...)`/`.isolated()` don't exist on them:

```ts
// resources.ts — persisted when the App is declared with App({ cache }).
export const draft = app.Resource<Draft, { id: number }>();
```

```ts
actions.useAction(Actions.Save, (context, { id, text }) => {
  context.actions.resource(resource.draft({ id })).set({ id, text });
});

actions.useAction(Actions.Discard, (context, { id }) => {
  context.actions.resource(resource.draft({ id })).evict();
});

// Subscribers can't tell whether the value was fetched or written locally.
actions.useAction(resource.draft.action({ id: 5 }), (context, value) => {
  context.actions.produce(({ model }) => void (model.draft = value));
});
```

Reach for a local resource when a value needs params-keyed slots, sync reads, broadcast fan-out, or reload persistence (drafts, last-selected tab, an offline queue) &mdash; component-local state still belongs in the model and cross-cutting ambient state in the Env.

See the [Resource recipe](./recipes/use-resource.md) for the three-tier error handling model, parameterised resources, local resources, and limitations.

By default an `app.Resource`'s cache is in-memory only &ndash; it resets on every page load. To keep the most recent successful payload around between sessions, wire a `Cache` into `App({ cache })`. Every `app.Resource` declared on that App writes through to the shared Cache and seeds from it on the next reload; resources are namespaced internally so they don't collide on shared params keys:

```ts
// app.ts
import { App, Cache } from "march-hare";

export const app = App({
  env: { session: null as Session | null },
  cache: Cache({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    keys: () => Object.keys(localStorage),
  }),
});
```

```ts
// resources.ts
import { app } from "./app";

export const cat = app.Resource((context) =>
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
    cat: resource.cat.get(),
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

For multi-tenant apps that share a single backing store, add a `key(context)` callback alongside the adapter methods to derive a per-context prefix from the live `<app.Boundary>` Env. The callback receives the same `{ env }` an `app.Resource` fetcher sees; its return value is prepended to every cache slot, so two users on the same device do not see each other's data:

```ts
// app.ts
type AppEnv = { session: { accessToken: string } | null };

export const app = App<AppEnv>({
  env: { session: null },
  cache: Cache<AppEnv>({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    keys: () => Object.keys(localStorage),
    key: ({ env }) => env.session?.accessToken ?? "",
  }),
});
```

Successful writes for Alice land under `mh:alice:0:{...}`; Bob's land under `mh:bob:0:{...}`. The Cache layer prepends a global `mh:` namespace so `cache.clear()` and partial-match eviction can scope themselves to March Hare's own entries on shared backends, leaving third-party `localStorage` state untouched. Return `""`, `null`, or `undefined` from `key(context)` to skip the per-context prefix &ndash; useful for the signed-out gap.

The adapter contract is **strictly synchronous** &ndash; `get` / `set` / `remove` / `keys` all return immediately, with no `Promise`. The model-literal read (`{ user: resource.user.get() }`) is evaluated during render and has no place to wait. React Native projects should use [`react-native-mmkv`](https://github.com/mrousavy/react-native-mmkv), which is sync out of the box and drops straight into the contract; `AsyncStorage` is incompatible. Truly async backends (IndexedDB, `chrome.storage.local`) need a sync facade hydrated at app entry &ndash; see the [storage recipe](./recipes/storage.md).

See the [storage recipe](./recipes/storage.md) for backend adapters (React Native `react-native-mmkv`, browser `localStorage`, browser extension `chrome.storage`), sign-out purge, and the `unset` sentinel that keeps "nothing stored" distinct from "a legitimately stored null".

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

Matching follows a single rule: every key the **subscriber** supplies must be present and equal on the dispatch channel. The subscriber's controller is the filter, more keys narrow it. Extra keys on the dispatch channel are ignored, so the dispatcher is free to be more specific than any single subscriber needs. Uncalled actions on either side bypass channel filtering entirely. See the [channeled-actions recipe](./recipes/channeled-actions.md#channel-matching) for the full matrix.

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

A few rules:

- **Scope is confined to the subtree.** Multicast dispatches inside `<scope.Boundary>` reach every subscriber inside the same boundary, and only those subscribers. Sibling boundaries don't see each other; nothing outside any boundary sees them either.
- **Nesting shadows.** `<scope.Boundary>` is a React context provider, so an inner boundary fully shadows an outer one for its subtree. If you need a single scope to dispatch actions from multiple multicast classes, declare them as a union at the call site &mdash; e.g. `app.Scope<typeof PaymentMulticast | typeof RoomMulticast>()`.
- **No `scope.Scope()`.** The handle deliberately omits a nested factory. Open another scope by calling `app.Scope<...>()` again and rendering its `<Boundary>` &mdash; that way the multicast surface stays declared at the call site.
- **Replay on late-mount is per-scope.** Like broadcast, multicast caches its most recent payload per action symbol; components that mount later inside the same boundary pick up the cached value through their `useAction` handler. See the [mount deduplication recipe](./recipes/mount-broadcast-deduplication.md) if you also fetch in `Lifecycle.Mount()`.

See the [multicast recipe](./recipes/multicast-actions.md) for more details. When the scope itself needs to be reusable across multiple hosts, reach for `shared.Scope<HostEnvs, typeof MulticastActions>()` &mdash; the standalone form covered in [Reusable components](#reusable-components). The rule of thumb: never reach for a second `App()` to get a private channel; that's what multicast scopes exist for.

## Server-sent events

A broadcast action stops at the edge of its `<Boundary>`. An **omnicast** action goes one ring further out: it behaves exactly like a broadcast locally, and it is additionally carried to every connected client &mdash; other tabs, browsers, and devices &mdash; through a Server-Sent Events server (the reference implementation is [Akela](https://github.com/Wildhoney/Akela), a Rust hub that fans out through Redis pub/sub so any number of server instances behave as one). There is no transport API to learn: declare the distribution, configure the App, and dispatch as normal.

Declare omnicast actions with `Distribution.Omnicast(schema?)`, inferring the payload type from a Zod-style schema. The schema is not decorative: server-sent events are remote input, so every envelope arriving over the wire is validated with `schema.parse` and **rejected when invalid** &mdash; a misbehaving peer cannot push malformed payloads into your handlers.

```ts
import { Action, Distribution } from "march-hare";
import { z } from "zod";

export namespace Payload {
  export const Cat = z.object({ id: z.string(), name: z.string() });
  export type Cat = z.infer<typeof Cat>;
}

export namespace Omnicast {
  export class Cat {
    static Adopted = Action("Cat.Adopted", Distribution.Omnicast(Payload.Cat));
  }
  export class Cattery {
    static Opened = Action("Cattery.Opened", Distribution.Omnicast());
  }
}

export class AppActions {
  static Broadcast = Broadcast;
  static Omnicast = Omnicast;
}
```

Point the App at the endpoint; the Boundary owns the connection lifecycle automatically &mdash; connect on mount, disconnect on unmount, reconnect via `EventSource` with tag re-application. `sse.actions` is the allow-list of what remote peers may dispatch into your Boundary:

```ts
export const app = App<Env.Cat>({
  env: { apiBase: "https://api.thecatapi.com/v1" },
  sse: { url: "http://localhost:8080", actions: Omnicast },
});
```

Component `Actions` classes extend `AppActions`, and dispatching works through the one function you already use &mdash; the omnicast brand routes the extra wire leg:

```ts
export class Actions extends AppActions {
  static OpenNew = Action("Cattery.OpenNew");
}

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ cats: [] });

  actions.useAction(Actions.OpenNew, async (context) => {
    await context.actions.dispatch(Actions.Omnicast.Cattery.Opened);
  });

  actions.useAction(Actions.Omnicast.Cattery.Opened, (context) => {
    context.actions.produce(({ model }) => void (model.cats = []));
    context.actions.resource.nuke();
  });

  return actions;
}
```

Dispatching an omnicast action performs both legs in one call: the action fires locally through the normal dispatch pipeline (including value caching for late subscribers), and the `{ name, payload }` envelope is published to the server for every **other** client &mdash; the sender is excluded server-side, so nothing double-fires. Receiving Boundaries validate the payload against the action's schema, then dispatch it locally; subscribers `useAction` it as usual and cannot tell local from remote. Without an `sse` config, omnicast actions degrade gracefully to plain broadcasts.

Connections hold a mutable set of tags (seeded from `sse.tags`), and passing `{ tags: ["vip"] }` as the third argument of `dispatch` narrows the wire leg to clients holding **all** of the supplied tags &mdash; extras permitted. Without tags, sends are public.

See the [SSE recipe](./recipes/sse.md) for the server protocol, reconnect semantics, the `AppActions` pattern, and testing guidance.

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

`App()` can also be called with no arguments &mdash; `env` is optional. Reach for it when the app coordinates entirely through models and broadcast actions and doesn't need any ambient state:

```ts
// app.ts
import { App } from "march-hare";

export const app = App();
```

## Reusable components

> **App = host, Scope = feature.** One `App<HostEnv>()` per deployable; everything inside it is a component. A component that needs a private channel reaches for `shared.Scope<HostEnvs, _>()`, never another `App()`. A component that runs under more than one `App` reaches for `shared.useContext<HostEnvs, M, A>()` instead of binding to a specific `app`. That one rule keeps the dependency graph acyclic, lets cross-cutting state (session, locale, permissions) live in a single Env, and gives [Feature Sliced Design](https://feature-sliced.design/) a 1:1 runtime expression &mdash; shared layer reuses `shared.X` against a `HostEnvs` union, features open `shared.Scope`s, hosts declare the App.

Importing `app` from a single location is fine inside a feature, but it breaks when a component needs to run under **more than one** `App` &mdash; a shared `<Profile />` used by both a web app and a mobile shell, for example. For that case, every `app.X` factory has a **standalone counterpart** on the `shared` namespace that takes the Env shape `E` as its mandatory first generic:

| Bound to an App             | Standalone (`shared.X`)           |
| --------------------------- | --------------------------------- |
| `app.useContext<M, A, D>()` | `shared.useContext<E, M, A, D>()` |
| `app.useEnv()`              | `shared.useEnv<E>()`              |
| `app.Resource<T, P>(...)`   | `shared.Resource<E, T, P>(...)`   |
| `app.Scope<A>()`            | `shared.Scope<E, A>()`            |

The standalone forms take the same runtime path as the App-bound ones &mdash; `E` is purely a type-level binding the caller supplies so reusable code stays App-agnostic.

```tsx
import { Action, shared } from "march-hare";

type WebEnv = { session: Session | null; locale: string };
type MobileEnv = { session: Session | null; platform: "ios" | "android" };
type Envs = WebEnv | MobileEnv;

type Model = { name: string | null };
const model: Model = { name: null };

class Actions {
  static Sign = Action<string>("Sign");
}

function useProfileActions() {
  const context = shared.useContext<Envs, Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Sign, (context, name) =>
    context.actions.produce(({ model }) => void (model.name = name)),
  );

  return actions;
}

export default function Profile(): React.ReactElement {
  const [model, actions] = useProfileActions();

  return (
    <button onClick={() => actions.dispatch(Actions.Sign, "Adam")}>
      Hey {model.name}
    </button>
  );
}
```

Drop `<Profile />` inside `<web.Boundary>` and it reads the web app's env; drop it inside `<mobile.Boundary>` and it reads the mobile app's env. The component never references either `App()` handle.

When more than one `App` lives in your repo, declare a union of every Env once and parameterise every reusable component against it. Keys present on every member resolve directly; keys on a subset need an `in` / `typeof` guard:

```ts
// shared/envs.ts
export type WebEnv = { session: Session | null; locale: string };
export type MobileEnv = {
  session: Session | null;
  platform: "ios" | "android";
};
export type Envs = WebEnv | MobileEnv;
```

```tsx
import { shared } from "march-hare";
import type { Envs } from "../shared/envs";

function Where(): React.ReactElement {
  const env = shared.useEnv<Envs>();

  const signedIn = env.session !== null;
  const where = "locale" in env ? env.locale : env.platform;

  return <span>{signedIn ? where : "signed out"}</span>;
}
```

`shared.Resource<E, T, P>` is the same story for shared resources &mdash; declare them at module scope, pass the Env union as the first generic, and the fetcher's `context.env` is typed against it. The fetcherless form keeps the same generic order: `shared.Resource<E, T, P>()` declares a local resource with `E` leading even though no fetcher reads it. Shared resources always use an isolated in-memory cache; reach for `app.Resource` when persistence is required, since the cache is wired into the App via `App({ cache })`. `shared.Scope<E, A>()` opens a multicast scope without going through an App handle. See the [reusable components recipe](./recipes/reusable-components.md) for the full pattern including discriminator-keyed switches and the `App()`-with-no-env case.

When a reusable component or resource is genuinely Env-agnostic &mdash; the fetcher never touches `context.env`, the hook never calls `shared.useEnv` &mdash; pass `Envless` as `E` instead of spelling out `Record<never, never>`: `shared.Resource<Envless, T>`, `shared.useContext<Envless, M, A>()`. It's a named alias for the empty-record shape exported from `march-hare`, kept around purely for legibility at the call site.

For one-line handler binding &mdash; flipping a boolean, assigning a payload to a leaf, pinning a field to a fixed value &mdash; reach for `context.with.{update,invert,always}`. See the [`With` helpers recipe](./recipes/with-helpers.md) for the full surface.

## Scaffolding CLI

A [Hygen](https://github.com/jondot/hygen)-style scaffolder ships under [`src/cli/`](./src/cli/) as the `mh` binary. It mirrors the layout of [`src/example/`](./src/example/) and the FSD layering rules enforced by `eslint-plugin-boundaries` &mdash; imports flow strictly downward (`app → features → shared`).

```bash
cd src/cli
npm install
npm link          # creates the global `mh` binary
```

Run it with no arguments for an interactive menu, or drive any leaf command directly:

```bash
mh                            # banner + interactive menu
mh init my-project            # bootstrap a new project
mh feature new add-cat        # add a stateful feature
mh app new dashboard          # add a page
mh shared component card      # add a shared component
mh feature action counter Reset   # inject an Action + handler stub
```

Every command lives in a tree &mdash; typing `mh feature` opens a sub-menu, typing `mh feature new` prompts for a name, typing `mh feature new add-cat` runs non-interactively. See [`src/cli/README.md`](./src/cli/README.md) for the full command surface, the template format, and instructions for adding your own generators.
