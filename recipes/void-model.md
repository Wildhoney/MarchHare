# Void Model and Void Actions

Both the model and actions type parameters default to `void`, so you can omit them entirely when neither is needed:

```ts
import { useActions, Lifecycle } from "chizu";

class Actions {
  static Mount = Lifecycle.Mount();
}

// Bare call — M defaults to void
const actions = useActions<void, typeof Actions>();

actions.useAction(Actions.Mount, () => {
  console.log("Mounted!");
});
```

When a component needs to dispatch or listen to actions but doesn't manage any local state, pass `void` as the model type:

```ts
import { useActions, Action } from "chizu";

class Actions {
  static Ping = Action("Ping");
}

const actions = useActions<void, typeof Actions>();

actions.useAction(Actions.Ping, () => {
  console.log("Pinged!");
});
```

You can also pass `void` for just the actions parameter while keeping a model:

```ts
const actions = useActions<Model, void>(initialModel);
```

## When to use a void model

- **Event forwarding** &ndash; A component that listens to one action and dispatches another.
- **Side-effects** &ndash; Logging, analytics, or external API calls that don't need local state.
- **Bridging** &ndash; Connecting broadcast or multicast events to non-React systems (e.g. a WebSocket client).
- **Coordination** &ndash; Orchestrating other components via dispatch without storing data.

## Lifecycle hooks

Lifecycle actions work exactly as they do with a regular model. Add lifecycle factories to your `Actions` class:

```ts
class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Ping = Action("Ping");
}

const actions = useActions<void, typeof Actions>();

actions.useAction(Actions.Mount, () => {
  console.log("Component mounted");
});

actions.useAction(Actions.Unmount, () => {
  console.log("Component unmounting");
});
```

## Using reactive data

If you need access to props or other external values, pass a data callback as the first argument. The third generic specifies the data shape:

```ts
function useTrackingActions(props: { userId: string }) {
  const actions = useActions<void, typeof Actions, { userId: string }>(() => ({
    userId: props.userId,
  }));

  actions.useAction(Actions.Track, async (context) => {
    await fetch(`/api/track/${context.data.userId}`);
  });

  return actions;
}
```

## Broadcast and multicast

Void-model components can participate in broadcast and multicast communication. This is particularly useful for "listener-only" components:

```ts
import { useActions, Action, Distribution } from "chizu";

class BroadcastActions {
  static UserLoggedIn = Action<string>("UserLoggedIn", Distribution.Broadcast);
}

class Actions {
  static Broadcast = BroadcastActions;
}

export default function useAnalyticsActions() {
  const actions = useActions<void, typeof Actions>();

  actions.useAction(Actions.Broadcast.UserLoggedIn, (_context, username) => {
    analytics.track("login", { username });
  });

  return actions;
}
```

## What isn't available

With a void model, `context.actions.produce` is still callable but there is nothing to mutate &ndash; TypeScript types the draft model as `void`, preventing property access. Similarly, `actions.inspect` returns an empty object since there are no fields to inspect.
