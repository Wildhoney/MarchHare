<div align="center">
  <img src="/media/logo.png" width="475" />

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
- No need to memoize callbacks &ndash; handlers are stable via [`useEffectEvent`](https://react.dev/reference/react/experimental_useEffectEvent).
- Clear separation between business logic and markup.
- Complements [Feature Slice Design](https://feature-sliced.design/) architecture.
- Strongly typed dispatches, models, payloads, etc.
- Built-in request cancellation with `AbortController`.
- Granular async state tracking per model field.
- Declarative lifecycle hooks without `useEffect`.
- Centralised error handling via the `Error` component.

## Getting started

We dispatch the `Actions.Name` event upon clicking the "Sign in" button and within `useNameActions` we subscribe to that same event so that when it's triggered it updates the model with the payload &ndash; in the React component we render `model.name`. The `Bound` helper binds the action's payload directly to a model property.

```tsx
import { useActions, Action, Bound } from "chizu";

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

  actions.useAction(Actions.Name, Bound("name"));

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

Each action should be responsible for managing its own data &ndash; in this case our `Profile` action handles fetching the user but other components may want to consume it &ndash; for that we should use a distributed action:

```tsx
class DistributedActions {
  static Name = Action("Name", Distribution.Broadcast);
}
```

```tsx
actions.useAction(Actions.Name, async (context) => {
  context.actions.produce((draft) => {
    draft.model.name = context.actions.annotate(Op.Update, null);
  });

  const name = await fetch(api.user());

  context.actions.produce((draft) => {
    draft.model.name = name;
  });

  context.actions.dispatch(DistributedActions.Name, name);
});
```

Note that in practice it'd be recommended to keep your `Actions` for local events and then have a single application-wide `DistributedActions` that defines all of the distributed events &ndash; in your `Actions` just have `class Actions extends DistributedActions`

Once we have the distributed action if we simply want to read the `name` when it's updated we can use consume:

```tsx
export default function Subscriptions(): React.ReactElement {
  return (
    <>
      Manage your subscriptions for your{" "}
      {actions.consume(DistributedActions.Name, (name) => name.value)} account.
    </>
  );
}
```

However if we want to listen for it and perform another operation in it in our local component we can do that via `useActions`:

```tsx
actions.useAction(DistributedActions.Name, async (context, name) => {
  const friends = await fetch(api.friends(name));

  context.actions.produce((draft) => {
    draft.model.friends = `${name}!`;
  });
});
```
