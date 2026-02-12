<div align="center">
  <img src="/media/logo-v2.png" width="475" />

[![Checks](https://github.com/Wildhoney/Chizu/actions/workflows/checks.yml/badge.svg)](https://github.com/Wildhoney/Chizu/actions/workflows/checks.yml)

</div>

Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

**[View Live Demo →](https://wildhoney.github.io/Chizu/)**

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
- Centralised error handling via the `Error` component.
- React Native compatible &ndash; uses [eventemitter3](https://github.com/primus/eventemitter3) for cross-platform pub/sub.

## Getting started

We dispatch the `Actions.Name` event upon clicking the "Sign in" button and within `useNameActions` we subscribe to that same event so that when it's triggered it updates the model with the payload &ndash; in the React component we render `model.name`. The `With` helper binds the action's payload directly to a model property.

```tsx
import { useActions, Action, With } from "chizu";

type Model = {
  name: string | null;
};

const model: Model = {
  name: null,
};

export class Actions {
  static Name = Action<string>("Name");
}

export default function useNameActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Name, With("name"));

  return actions;
}
```

```tsx
export default function Profile(): React.ReactElement {
  const [model, actions] = useNameActions();

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

When you need to do more than just assign the payload &ndash; such as making an API request &ndash; expand `useAction` to a full function. It can be synchronous, asynchronous, or even a generator:

```tsx
actions.useAction(Actions.Name, async (context) => {
  context.actions.produce((draft) => {
    draft.model.name = context.actions.annotate(Op.Update, null);
  });

  const name = await fetch(api.user());

  context.actions.produce((draft) => {
    draft.model.name = name;
  });
});
```

Notice we're using `annotate` which you can read more about in the [Immertation documentation](https://github.com/Wildhoney/Immertation). Nevertheless once the request is finished we update the model again with the `name` fetched from the response and update our React component again.

If you need to access external reactive values (like props or `useState` from parent components) that always reflect the latest value even after `await` operations, pass a data callback to `useActions`:

```tsx
const actions = useActions<Model, typeof Actions, { query: string }>(
  model,
  () => ({ query: props.query }),
);

actions.useAction(Actions.Search, async (context) => {
  await fetch("/search");
  // context.data.query is always the latest value
  console.log(context.data.query);
});
```

For more details, see the [referential equality recipe](./recipes/referential-equality.md).

Both the model and actions type parameters default to `void`, so you can call `useActions()` with no generics at all when neither is needed:

```tsx
import { useActions, Lifecycle } from "chizu";

const actions = useActions();

actions.useAction(Lifecycle.Mount, () => {
  console.log("Mounted!");
});
```

If your component doesn't need local state but still needs to dispatch or listen to typed actions, pass `void` as the model type. No initial model is required:

```tsx
import { useActions, Action, Lifecycle } from "chizu";

export class Actions {
  static Ping = Action("Ping");
}

export default function usePingActions() {
  const actions = useActions<void, typeof Actions>();

  actions.useAction(Actions.Ping, () => {
    console.log("Pinged!");
  });

  return actions;
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
  context.actions.produce((draft) => {
    draft.model.name = context.actions.annotate(Op.Update, null);
  });

  const name = await fetch(api.user());

  context.actions.produce((draft) => {
    draft.model.name = name;
  });

  context.actions.dispatch(Actions.Broadcast.Name, name);
});
```

Once we have the broadcast action, if we want to derive a value from the broadcast payload onto the model, use `useDerived`:

```tsx
const [model] = actions.useDerived({
  name: [Actions.Broadcast.Name, (name) => name],
});

// model.name is null until the first dispatch, then stays in sync
```

If we want to listen for it and perform another operation in our local component we can do that via `useAction`:

```tsx
actions.useAction(Actions.Broadcast.Name, async (context, name) => {
  const friends = await fetch(api.friends(name));

  context.actions.produce((draft) => {
    draft.model.friends = friends;
  });
});
```

Or read the latest broadcast value directly in a handler with `context.actions.read`:

```tsx
actions.useAction(Actions.FetchFriends, async (context) => {
  const name = context.actions.read(Actions.Broadcast.Name);
  if (!name) return;
  const friends = await fetch(api.friends(name));
  context.actions.produce(({ model }) => {
    model.friends = friends;
  });
});
```

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

For scoped communication between component groups, use multicast actions with the `<Scope>` component:

```tsx
import { Action, Distribution, Scope } from "chizu";

// Shared multicast actions
class MulticastActions {
  static Update = Action<number>("Update", Distribution.Multicast);
}

// Component-level actions reference shared multicast
class Actions {
  static Multicast = MulticastActions;
  static Increment = Action("Increment");
}

function App() {
  return (
    <>
      <Scope name="TeamA">
        <ScoreBoard />
        <PlayerList />
      </Scope>

      <Scope name="TeamB">
        <ScoreBoard />
        <PlayerList />
      </Scope>
    </>
  );
}

// Dispatch to all components within "TeamA" scope
actions.dispatch(Actions.Multicast.Update, 42, { scope: "TeamA" });

// Subscribe to multicast values with useDerived
const [model] = actions.useDerived({
  score: [Actions.Multicast.Update, (v) => v],
});
```

Unlike broadcast which reaches all components, multicast is scoped to the named boundary &ndash; perfect for isolated widget groups, form sections, or distinct UI regions.

For components that always render inside a scope, use the `withScope` HOC to eliminate the manual `<Scope>` wrapper:

```tsx
import { withScope } from "chizu";

export default withScope("payment-link", function Layout(): ReactElement {
  return (
    <div>
      <PaymentLink />
      <Outlet />
    </div>
  );
});
```

See the [multicast recipe](./recipes/multicast-actions.md) for more details.

For data that is expensive to fetch, use `cacheable` to cache values with a TTL. Define typed cache entries with `Entry` and call `context.actions.cacheable` inside a handler &ndash; the callback only runs when the cache is empty or expired:

```ts
import { Entry, useActions, Action } from "chizu";
import { O } from "@mobily/ts-belt";

class CacheStore {
  static Pairs = Entry<CryptoPair[]>();
  static User = Entry<User, { UserId: number }>();
}

class Actions {
  static FetchPairs = Action("FetchPairs");
  static FetchUser = Action("FetchUser");
}
```

```ts
actions.useAction(Actions.FetchPairs, async (context) => {
  const { data } = await context.actions.cacheable(
    CacheStore.Pairs,
    30_000,
    async () => O.Some(await api.fetchPairs()),
  );

  if (data) {
    context.actions.produce(({ model }) => {
      model.pairs = data;
    });
  }
});

// Channeled &ndash; independent cache per user
actions.useAction(Actions.FetchUser, async (context) => {
  const { data } = await context.actions.cacheable(
    CacheStore.User({ UserId: context.data.userId }),
    60_000,
    async () => O.Some(await api.fetchUser(context.data.userId)),
  );

  if (data) {
    context.actions.produce(({ model }) => {
      model.user = data;
    });
  }
});
```

Only `Some` / `Ok` values are stored in the cache. `None` and `Error` results are skipped. Use `context.actions.invalidate` to clear a specific entry so the next `cacheable` call fetches fresh data:

```ts
context.actions.invalidate(CacheStore.Pairs);
context.actions.invalidate(CacheStore.User({ UserId: 5 }));
```

The cache is scoped to the nearest `<Boundary>`. See the [caching recipe](./recipes/caching.md) for more details.

When you want to expose a derived value alongside your model without storing it separately, use `derive` to overlay computed properties on top of the model:

```tsx
type Model = {
  paymentLink: PaymentLink | null;
  partialCrypto: boolean;
};

export function usePaymentActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Broadcast.PaymentLink, (context, paymentLink) => {
    context.actions.produce(({ model }) => {
      model.paymentLink = paymentLink;
    });
  });

  const [model] = actions;

  return actions.derive({
    partialCrypto:
      model.paymentLink?.receivable?.partialCryptoPaymentDetected === true,
  });
}
```

The keys passed to `derive` must be existing model properties and the values must match their types. Consumers see the derived values when destructuring the model &ndash; no manual `produce` required. Calls can be chained: `actions.derive({ a: 1 }).derive({ b: 2 })`.

For action-driven derived values, use `useDerived` to subscribe to actions and map their payloads onto the model:

```tsx
return actions.useDerived({
  doubled: [Actions.Broadcast.Counter, (counter) => counter * 2],
  label: [Actions.Decrement, () => "decremented"],
});
```

Derived values are `null` before the action fires. Callback parameters are auto-typed from the action's payload, and the component renders once even when a normal handler and a derived entry fire together.

See the [derived values recipe](./recipes/derived-values.md) for more details.
