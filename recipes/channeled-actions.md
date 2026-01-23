# Channeled Actions

Channeled actions allow targeted event delivery by subscribing with a channel object. This pattern is ideal for components that only care about updates relevant to them.

## Basic Usage

Define a channel type as the second generic argument and call the action to create a channeled dispatch:

```tsx
import { useActions, Action } from "chizu";

type User = { id: number; name: string };

class Actions {
  // Second generic arg defines the channel type
  static UserUpdated = Action<User, { UserId: number }>("UserUpdated");
}

function UserCard({ userId }: { userId: number }) {
  const actions = useActions<Model, typeof Actions>(model);

  // Only fires when dispatched with matching channel
  actions.useAction(
    Actions.UserUpdated({ UserId: userId }),
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user = user;
      });
    },
  );

  return <div>{actions[0].user?.name}</div>;
}
```

## Channel Matching

The channel is an object where each key-value pair must match. By convention, use **uppercase keys** (e.g., `{UserId: 4}` not `{userId: 4}`) to distinguish channel keys from payload properties.

### Dispatch with exact channel

```ts
// Only handlers with matching UserId fire
actions.dispatch(Actions.UserUpdated({ UserId: 5 }), user);
```

### Dispatch with subset channel (fan out)

```ts
// Fires ALL handlers where Role === "admin"
// Matches: {Role: "admin"}, {Role: "admin", UserId: 5}, {Role: "admin", UserId: 10}
actions.dispatch(Actions.UserUpdated({ Role: "admin" }), user);
```

### Broadcast dispatch (all handlers)

```ts
// ALL handlers fire: plain handlers AND all channeled handlers
actions.dispatch(Actions.UserUpdated, user);
```

## Channel Value Types

Channel types must be a `Record<string, FilterValue>` where `FilterValue` is a non-nullable primitive (`string`, `number`, `bigint`, `boolean`, or `symbol`). This constraint is enforced at compile time.

```ts
class Actions {
  // Valid — object with primitive values
  static Update = Action<Data, { UserId: number }>("Update");
  static UpdateByRole = Action<Data, { Role: string; Slug: string }>(
    "UpdateByRole",
  );
  static UpdateActive = Action<Data, { Active: boolean }>("UpdateActive");
  static UpdateByKey = Action<Data, { Key: symbol }>("UpdateByKey");

  // Invalid — TypeScript error: Type 'string' does not satisfy the constraint 'Filter'
  static Invalid = Action<Data, string>("Invalid");

  // Invalid — TypeScript error: Type 'number' does not satisfy the constraint 'Filter'
  static AlsoInvalid = Action<Data, number>("AlsoInvalid");
}

// Usage
actions.useAction(Actions.Update({ UserId: 123 }), handler);
actions.useAction(
  Actions.UpdateByRole({ Role: "admin", Slug: "abc-def" }),
  handler,
);
actions.useAction(Actions.UpdateActive({ Active: true }), handler);

const myKey = Symbol("my-key");
actions.useAction(Actions.UpdateByKey({ Key: myKey }), handler);
```

`null` and `undefined` are explicitly forbidden as channel values.

## Multi-Property Channels

Channels can have multiple properties for precise targeting:

```ts
class Actions {
  static UserUpdated = Action<User, { OrgId: number; Role: string }>(
    "UserUpdated",
  );
}

// Subscribe to updates for admin users in a specific org
actions.useAction(
  Actions.UserUpdated({ OrgId: props.orgId, Role: "admin" }),
  (context, user) => {
    context.actions.produce((draft) => {
      draft.model.user = user;
    });
  },
);

// Dispatch to all handlers matching the channel
actions.dispatch(Actions.UserUpdated({ OrgId: 42, Role: "admin" }), user);
```

## Real-World Example: Multi-User Dashboard

```tsx
import { useActions, Action, Lifecycle, Distribution } from "chizu";

type User = { id: number; name: string; status: string };
type Model = { user: User | null };

class Actions {
  static UserUpdated = Action<User, { UserId: number }>(
    "UserUpdated",
    Distribution.Broadcast,
  );
}

// WebSocket connection component
function UserWebSocket() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Lifecycle.Mount, (context) => {
    const ws = new WebSocket("/users/stream");

    ws.onmessage = (event) => {
      const user = JSON.parse(event.data) as User;
      // Dispatch to specific user's channel
      context.actions.dispatch(Actions.UserUpdated({ UserId: user.id }), user);
    };

    context.task.controller.signal.addEventListener("abort", () => {
      ws.close();
    });
  });

  return null;
}

// Individual user card - only receives its own updates
function UserCard({ userId }: { userId: number }) {
  const actions = useActions<Model, typeof Actions>(model);

  // Only fires for this specific user's updates
  actions.useAction(
    Actions.UserUpdated({ UserId: userId }),
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user = user;
      });
    },
  );

  return (
    <div>
      <h3>{actions[0].user?.name}</h3>
      <span>{actions[0].user?.status}</span>
    </div>
  );
}

// Dashboard showing multiple users
function Dashboard() {
  const userIds = [1, 2, 3, 4, 5];

  return (
    <>
      <UserWebSocket />
      {userIds.map((id) => (
        <UserCard key={id} userId={id} />
      ))}
    </>
  );
}
```

## Combined with Plain Handlers

You can subscribe to both plain and channeled handlers for the same action:

```ts
// Fires for ALL UserUpdated dispatches (including channeled ones)
actions.useAction(Actions.UserUpdated, (context, user) => {
  console.log("Any user updated:", user.id);
});

// Fires ONLY when channel matches
actions.useAction(Actions.UserUpdated({ UserId: 1 }), (context, user) => {
  console.log("User 1 specifically updated");
});
```

When you dispatch to a plain action, both handlers fire. When you dispatch with a channel, only matching channeled handlers fire (plus plain handlers always fire).

## Summary

| Dispatch Pattern                            | Handlers That Fire                       |
| ------------------------------------------- | ---------------------------------------- |
| `dispatch(Action, payload)`                 | ALL handlers (plain + all channeled)     |
| `dispatch(Action({ Key: value }), payload)` | Channeled handlers where `Key === value` |
