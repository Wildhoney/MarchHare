# Broadcast invalidation

When a domain event occurs (e.g. user signs out, permissions change, locale switches), multiple producers may need to re-fetch and re-broadcast their data. This recipe shows how to coordinate that without coupling producers to each other.

## The problem

A component fetches user data on mount and broadcasts it:

```ts
async function fetchUser(context: HandlerContext<Model, Actions, Data>) {
  const user = await api.fetchUser(context.data.userId, {
    signal: context.task.controller.signal,
  });
  context.actions.dispatch(Actions.Broadcast.User, user);
}

actions.useAction(Actions.Mount, fetchUser);
```

Another component fetches settings:

```ts
async function fetchSettings(context: HandlerContext<Model, Actions>) {
  const settings = await api.fetchSettings({
    signal: context.task.controller.signal,
  });
  context.actions.dispatch(Actions.Broadcast.Settings, settings);
}

actions.useAction(Actions.Mount, fetchSettings);
```

When the user signs out, both need to re-fetch. But `Actions.Broadcast.User` takes a `userId` and `Actions.Broadcast.Settings` takes no arguments &mdash; you cannot simply "replay" them.

## Solution: shared reset action

Add a `Reset` action to the shared broadcast class. Each producer subscribes to it and re-fetches using its own logic:

```ts
// shared/types.ts
export class BroadcastActions {
  static Reset = Action("Reset", Distribution.Broadcast);
  static User = Action<User>("User", Distribution.Broadcast);
  static Settings = Action<Settings>("Settings", Distribution.Broadcast);
}
```

Producers listen for the reset alongside their mount logic:

```ts
// user/actions.ts
export class Actions {
  static Mount = Lifecycle.Mount();
  static Broadcast = BroadcastActions;
}

async function fetchUser(context: HandlerContext<Model, Actions, Data>) {
  const user = await api.fetchUser(context.data.userId, {
    signal: context.task.controller.signal,
  });
  context.actions.dispatch(Actions.Broadcast.User, user);
}

actions.useAction(Actions.Mount, fetchUser);
actions.useAction(Actions.Broadcast.Reset, fetchUser);
```

```ts
// settings/actions.ts
export class Actions {
  static Mount = Lifecycle.Mount();
  static Broadcast = BroadcastActions;
}

async function fetchSettings(context: HandlerContext<Model, Actions>) {
  const settings = await api.fetchSettings({
    signal: context.task.controller.signal,
  });
  context.actions.dispatch(Actions.Broadcast.Settings, settings);
}

actions.useAction(Actions.Mount, fetchSettings);
actions.useAction(Actions.Broadcast.Reset, fetchSettings);
```

Any component can trigger the reset:

```ts
actions.dispatch(Actions.Broadcast.Reset);
```

Each producer re-fetches using its own parameters. The reset action carries no payload &mdash; it is purely a signal.

## Typed reset payloads

When different reset scenarios require different behaviour, give the reset action a payload:

```ts
type ResetScope = "auth" | "preferences" | "all";

export class BroadcastActions {
  static Reset = Action<ResetScope>("Reset", Distribution.Broadcast);
  static User = Action<User>("User", Distribution.Broadcast);
  static Settings = Action<Settings>("Settings", Distribution.Broadcast);
}

// Only re-fetch when auth or all resets are triggered
actions.useAction(Actions.Broadcast.Reset, (context, scope) => {
  if (scope !== "auth" && scope !== "all") return;
  fetchUser(context);
});
```

## Comparison with React Query

| React Query                      | March Hare                                     |
| -------------------------------- | ---------------------------------------------- |
| `queryClient.invalidateQueries`  | Dispatch a shared broadcast reset action       |
| Automatic re-fetch on invalidate | Producer handles re-fetch in its reset handler |
| Tag-based invalidation           | Typed payload on the reset action              |
| Global query client              | Scoped to `<Boundary>`                         |

The key difference: React Query owns the fetch function and can re-run it. In March Hare, the producer owns the fetch logic, so invalidation is a signal that tells producers to re-run themselves.
