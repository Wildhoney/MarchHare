# Void Model and Void Actions

The model type parameter defaults to `void`, so you can omit it when no local state is needed:

```ts
import { Lifecycle } from "march-hare";
import { app } from "./app";

class Actions {
  static Mount = Lifecycle.Mount();
}

const context = app.useContext<void, typeof Actions>();
const actions = context.useActions();

actions.useAction(Actions.Mount, () => {
  console.log("Mounted!");
});
```

To dispatch or listen to actions without managing local state, call `context.useActions()` with no arguments:

```ts
import { Action } from "march-hare";
import { app } from "./app";

class Actions {
  static Ping = Action("Ping");
}

const context = app.useContext<void, typeof Actions>();
const actions = context.useActions();

actions.useAction(Actions.Ping, () => {
  console.log("Pinged!");
});
```

If you want a model but no typed actions class, declare the controller with only the model generic:

```ts
const context = app.useContext<Model>();
const actions = context.useActions(initialModel);
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

const context = app.useContext<void, typeof Actions>();
const actions = context.useActions();

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
function useActions(props: { userId: string }) {
  const context = app.useContext<{ userId: string }, typeof Actions>();
  const actions = context.useActions(() => ({
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
import { Action, Distribution } from "march-hare";
import { app } from "./app";

class BroadcastActions {
  static UserLoggedIn = Action<string>("UserLoggedIn", Distribution.Broadcast);
}

class Actions {
  static Broadcast = BroadcastActions;
}

export default function useActions() {
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.Broadcast.UserLoggedIn, (_context, username) => {
    analytics.track("login", { username });
  });

  return actions;
}
```

## What isn't available

With a void model, `context.actions.produce` is still callable but there is nothing to mutate &ndash; TypeScript types the draft model as `void`, preventing property access. Similarly, `actions.inspect` returns an empty object since there are no fields to inspect.
