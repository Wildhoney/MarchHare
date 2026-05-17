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
- React Native compatible &ndash; uses [eventemitter3](https://github.com/primus/eventemitter3) for cross-platform pub/sub.

## Getting started

We dispatch the `Actions.Name` event upon clicking the "Sign in" button and within the component we subscribe to that same event via `useActions` so that when it's triggered it updates the model with the payload &ndash; in the React component we render `model.name`. The `With.Update` helper binds the action's payload directly to a model property.

```tsx
import { useActions, Action, With } from "march-hare";

type Model = {
  name: string | null;
};

const model: Model = {
  name: null,
};

export class Actions {
  static Name = Action<string>("Name");
}

export default function Profile(): React.ReactElement {
  const [state, actions] = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Name, With.Update("name"));

  return (
    <>
      <p>Hey {state.name}</p>

      <button onClick={() => actions.dispatch(Actions.Name, randomName())}>
        Sign in
      </button>
    </>
  );
}
```

When you need to do more than just assign the payload &ndash; such as making an API request &ndash; expand `useAction` to a full function. It can be synchronous, asynchronous, or even a generator. Remote data goes through `Resource` rather than a bare `fetch` &ndash; declare the resource at module scope and consume it via `useResource`:

```ts
// resources.ts
import { Resource } from "march-hare";

export const user = Resource(() => ky.get(api.user()).json<User>());
```

```tsx
const get = {
  user: useResource(resource.user),
};

actions.useAction(Actions.Name, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.name = context.actions.annotate(model.name, Op.Update)),
  );

  const data = await get.user();

  context.actions.produce(({ model }) => void (model.name = data.name));
});
```

Notice we're using `annotate` which you can read more about in the [Immertation documentation](https://github.com/Wildhoney/Immertation). Once the request is finished we update the model again with the name fetched from the response and re-render the React component. `Resource` caches the most recent successful payload and exposes typed params &ndash; the full API is covered [further down](#remote-data).

If you need to access external reactive values (like props or `useState` from parent components) that always reflect the latest value even after `await` operations, pass a data callback to `useActions`:

```tsx
const actions = useActions<Model, typeof Actions, { query: string }>(
  model,
  () => ({ query: props.query }),
);

const get = {
  search: useResource(resource.search),
};

actions.useAction(Actions.Search, async (context) => {
  await get.search({ query: context.data.query });
  // context.data.query is always the latest value, even after await
  console.log(context.data.query);
});
```

For more details, see the [referential equality recipe](./recipes/referential-equality.md).

Both the model and actions type parameters default to `void`, so you can call `useActions()` with no generics at all when neither is needed:

```tsx
import { useActions, Lifecycle } from "march-hare";

class Actions {
  static Mount = Lifecycle.Mount();
}

const actions = useActions<void, typeof Actions>();

actions.useAction(Actions.Mount, () => {
  console.log("Mounted!");
});
```

If your component doesn't need local state but still needs to dispatch or listen to typed actions, pass `void` as the model type. No initial model is required:

```tsx
import { useActions, Action, Lifecycle } from "march-hare";

export class Actions {
  static Ping = Action("Ping");
}

export default function Pinger(): React.ReactElement {
  const [, actions] = useActions<void, typeof Actions>();

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
const get = {
  user: useResource(resource.user),
};

actions.useAction(Actions.Profile, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.name = context.actions.annotate(model.name, Op.Update)),
  );

  const data = await get.user();

  context.actions.produce(({ model }) => void (model.name = data.name));

  context.actions.dispatch(Actions.Broadcast.Name, data.name);
});
```

Once we have the broadcast action, if we want to listen for it and perform another operation in our local component we can do that via `useAction`:

```tsx
const get = {
  friends: useResource(resource.friends),
};

actions.useAction(Actions.Broadcast.Name, async (context, name) => {
  const data = await get.friends({ name });

  context.actions.produce(({ model }) => void (model.friends = data));
});
```

Both `read` and `peek` access the latest cached broadcast value without subscribing via `useAction`. The difference is that `read` waits for any pending annotations on the corresponding model field to settle before resolving, whereas `peek` returns the value immediately:

```tsx
const get = {
  friends: useResource(resource.friends),
};

actions.useAction(Actions.FetchFriends, async (context) => {
  const name = await context.actions.resolution(Actions.Broadcast.Name);
  if (!name) return;
  const data = await get.friends({ name });
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
  const [model, actions] = useActions<Model, typeof Actions>(initialModel);

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

For remote data, declare a `Resource` at module scope and consume it via `useResource`. Every call fires its own request; the most recent successful response is cached in a module-level `WeakMap` keyed by the fetcher so `.if(...)` and `.else(...)` on the bound handle have something to read from. Convention is to keep all resources in `resources.ts` and import them as a namespace:

```ts
// resources.ts
import { Resource } from "march-hare";

export const user = Resource(() => ky.get("/api/user").json<User>());

export const pay = Resource((signal, body: Body) =>
  ky.post("/api/pay", { json: body, signal }).json<Receipt>(),
);
```

```tsx
// actions.ts
import { useActions, useResource } from "march-hare";
import * as resource from "./resources";

export function useActions() {
  // Bind the resources first so we can seed the initial model from the
  // cache via `.else(fallback)` — if a previous mount populated the
  // slot, the model starts with that value; otherwise the fallback.
  // Bindings are grouped by HTTP verb so call sites advertise read vs.
  // write at a glance.
  const get = {
    user: useResource(resource.user),
  };
  const post = {
    pay: useResource(resource.pay),
  };

  const actions = useActions<Model, typeof Actions>({
    user: get.user.else(null),
    receipt: post.pay.else(null),
  });

  actions.useAction(Actions.Mount, async (context) => {
    const data = await get.user.if(
      { over: { minutes: 5 } },
      context.task.controller.signal,
    );
    context.actions.produce(({ model }) => void (model.user = data));
  });

  actions.useAction(Actions.Submit, async (context, body) => {
    const receipt = await post.pay(context.task.controller.signal, body);
    context.actions.produce(({ model }) => void (model.receipt = receipt));
  });

  return actions;
}
```

`useResource(handle)` returns the fetch callable directly. The callable has two attached methods: `.if({ over })` skips the network when the cached payload is still fresh, and `.else(fallback)` reads the cached payload synchronously with a default. `Temporal` is read from the host runtime &ndash; bring a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) if your target environment does not yet expose it natively. `.if({ over })` accepts a `Temporal.Duration`, a `DurationLike` object, or an ISO 8601 duration string.

`Resource` takes a single fetcher argument. The fetcher receives the call-site `params` object as its only argument and returns a `Promise<T>`. There are no callbacks &ndash; no `onSuccess`, no `onError`, no injected `dispatch`. Side-effects after a run (broadcasting, analytics, model writes) live in the `useAction` handler that awaited the call, next to the rest of the flow:

```ts
export const user = Resource(() => ky.get("/api/user").json<User>());

actions.useAction(Actions.Mount, async (context) => {
  const data = await get.user();
  await context.actions.dispatch(Actions.Broadcast.UserUpdated, data);
  context.actions.produce(({ model }) => void (model.user = data));
});
```

`params` is the second generic on `Resource` and defaults to `{}`. Declare it when the fetcher needs call-time inputs &ndash; cursors, ids, query strings, request bodies. `params` is a single object (not positional args), which keeps call sites self-documenting:

```ts
type Params = { cursor: string | null };

export const feed = Resource((signal, { cursor }: Params) =>
  http
    .get("feed", { searchParams: { cursor: cursor ?? "" }, signal })
    .json<Page<Item>>(),
);

const get = {
  feed: useResource(resource.feed),
};
const page = await get.feed({ cursor: context.model.cursor });
```

A complete IntersectionObserver-driven infinite-scroll demo lives at [`src/example/transactions/`](./src/example/transactions/) &ndash; mock paginated API, scroll-triggered `LoadMore`, `pending()` guard, broadcast on success.

For typed failure routing, wrap the call in `try/catch` and use `instanceof` &ndash; TypeScript cannot type promise rejections, so narrowing happens in the handler that catches them:

```ts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await get.user();
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

For targeted event delivery, use channeled actions. Define a channel type as the second generic argument and call the action with a channel object &ndash; handlers fire when the dispatch channel matches:

```tsx
class Actions {
  // Second generic arg defines the channel type
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

Channel values support non-nullable primitives: `string`, `number`, `boolean`, or `symbol`. By convention, use uppercase keys like `{UserId: 4}` to distinguish channel keys from payload properties.

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

For coordinating between async handlers without re-rendering the JSX tree, use the per-`<Boundary>` mode handle returned by `useMode()`. Thread it through the `useActions` data callback so it shows up as `context.data.mode` inside handlers, fully typed. Mode is **not** reactive &mdash; drive view state through the model, not mode.

```ts
import { useActions, useMode } from "march-hare";

enum Mode {
  Idle,
  SigningOut,
}

export function useActions() {
  const mode = useMode<Mode>();
  // Spell the data shape as the third generic so `context.data.mode` keeps
  // its concrete type inside handlers.
  const actions = useActions<Model, typeof Actions, { mode: typeof mode }>(
    model,
    () => ({ mode }),
  );

  actions.useAction(Actions.SignOut, async (context) => {
    context.data.mode.update(Mode.SigningOut);
    await api.signOut();
    context.data.mode.update(Mode.Idle);
  });

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.data.mode.read() === Mode.SigningOut) return;
    // ...
  });

  return actions;
}
```

Toggling boolean UI state &ndash; modals, sidebars, drawers &ndash; is one of the most common patterns. Bind a unicast action to a boolean field on the model with `With.Invert`:

```tsx
import { useActions, Action, With } from "march-hare";

type Model = {
  paymentDialog: boolean;
  sidebar: boolean;
};

export class Actions {
  static TogglePaymentDialog = Action("TogglePaymentDialog");
  static ToggleSidebar = Action("ToggleSidebar");
}

const [model, actions] = useActions<Model, typeof Actions>({
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
