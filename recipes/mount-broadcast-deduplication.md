# Mount and broadcast/multicast deduplication

When a component needs data that depends on a broadcast or multicast value, it is tempting to fetch in both `Lifecycle.Mount` (in case no event has fired yet) and in the broadcast/multicast handler (to react when the value arrives). However, because cached values are replayed during mount for both broadcast and multicast actions, both handlers fire &mdash; causing duplicate work.

## The problem

```ts
actions.useAction(Lifecycle.Mount, async (context) => {
  // Fetch because we don't know if a broadcast has fired yet.
  const users = await fetchUsers(context.task.controller.signal);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});

actions.useAction(Actions.Broadcast.Team, async (context, team) => {
  // Fetch when the broadcast arrives.
  const users = await fetchUsers(context.task.controller.signal, team.id);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});
```

If a cached broadcast value exists when the component mounts, the mount replay mechanism fires the broadcast handler immediately after `Lifecycle.Mount` &mdash; both still within `Phase.Mounting`. This results in two fetches for the same data.

## Why it happens

During mount, Chizu executes the following sequence inside a single `useLayoutEffect`:

1. Emit `Lifecycle.Mount` (handlers run with `phase = Mounting`).
2. For each registered broadcast action, check the `BroadcastEmitter` cache.
3. If a cached value exists, emit the action to the unicast emitter (handlers run with `phase = Mounting`).
4. Transition phase to `Mounted`.

Both steps 1 and 3 happen synchronously before the phase transitions, so both handlers fire during the same mount cycle.

## Solution A: Guard mount with `peek()`

Use `peek()` in `Lifecycle.Mount` to check whether a broadcast value already exists. If it does, skip the mount fetch and let the broadcast handler do the work:

```ts
actions.useAction(Lifecycle.Mount, async (context) => {
  const team = context.actions.peek(Actions.Broadcast.Team);
  if (team) return; // Broadcast replay will handle it.

  const users = await fetchUsers(context.task.controller.signal);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});

actions.useAction(Actions.Broadcast.Team, async (context, team) => {
  const users = await fetchUsers(context.task.controller.signal, team.id);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});
```

`peek()` reads from the `BroadcastEmitter` cache directly &mdash; the value is available even before the replay mechanism runs, because the cache was populated by the original dispatch.

**When to use:** The broadcast payload is needed for the fetch (e.g. a team ID), so the broadcast handler is the primary path and mount is only a fallback for when no broadcast has been dispatched yet.

## Solution B: Guard broadcast with `context.phase`

Use `context.phase` in the broadcast handler to skip the cached replay and let `Lifecycle.Mount` handle the initial fetch:

```ts
actions.useAction(Lifecycle.Mount, async (context) => {
  const users = await fetchUsers(context.task.controller.signal);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});

actions.useAction(Actions.Broadcast.Team, async (context, team) => {
  if (context.phase === Phase.Mounting) return; // Mount already handled it.

  const users = await fetchUsers(context.task.controller.signal, team.id);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});
```

Cached values replayed during mount arrive with `Phase.Mounting`. Live dispatches after mount arrive with `Phase.Mounted`. Checking the phase skips the replay without affecting future dispatches.

**When to use:** The mount fetch does not depend on the broadcast payload (e.g. loading a default dataset), and subsequent broadcasts should trigger fresh fetches with updated data.

## Comparison

| Approach                     | Mount fetches when&hellip; | Broadcast fetches when&hellip;   | Best for                           |
| ---------------------------- | -------------------------- | -------------------------------- | ---------------------------------- |
| **A &ndash; `peek()` guard** | No cached broadcast value  | Always (including replay)        | Broadcast payload drives the fetch |
| **B &ndash; `phase` guard**  | Always                     | Only live dispatches (`Mounted`) | Mount fetch is self-sufficient     |

## Multicast support

Both patterns work identically with multicast actions. Pass the scope name to `peek()`:

```ts
actions.useAction(Lifecycle.Mount, async (context) => {
  const team = context.actions.peek(Actions.Multicast.Team, {
    scope: "dashboard",
  });
  if (team) return;

  const users = await fetchUsers(context.task.controller.signal);
  context.actions.produce(({ model }) => {
    model.users = users;
  });
});
```
