# Channeled Actions

Channeled actions deliver events to targeted subscribers via a controller object, so a component receives only the updates relevant to it.

## Basic Usage

Define a controller type as the second generic argument and call the action to create a channeled dispatch:

```tsx
import { Action } from "march-hare";
import { app } from "./app";

type User = { id: number; name: string };

class Actions {
  // Second generic arg defines the controller type
  static UserUpdated = Action<User, { UserId: number }>("UserUpdated");
}

function UserCard({ userId }: { userId: number }) {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  // Only fires when dispatched with matching controller
  actions.useAction(
    Actions.UserUpdated({ UserId: userId }),
    (context, user) => {
      context.actions.produce((draft) => void (draft.model.user = user));
    },
  );

  return <div>{view[0].user?.name}</div>;
}
```

## Channel Matching

The controller is an object; each key-value pair the **subscriber** supplies must be present and equal on the dispatch channel. Keys the subscriber omits are not checked, so the subscriber's controller acts as a filter. Extra keys on the dispatch channel are ignored &mdash; the dispatcher can be more specific than any subscriber needs. By convention, use **uppercase keys** (e.g., `{UserId: 4}` not `{userId: 4}`) to distinguish controller keys from payload properties.

### Subscribe with an exact controller

```ts
actions.useAction(Actions.UserUpdated({ UserId: 5 }), handler);

actions.dispatch(Actions.UserUpdated({ UserId: 5 }), user); // Matches
actions.dispatch(Actions.UserUpdated({ UserId: 6 }), user); // No match
```

### Subscribe with a partial controller (fan in)

```ts
actions.useAction(Actions.UserUpdated({ Role: "admin" }), handler);

actions.dispatch(Actions.UserUpdated({ Role: "admin", UserId: 5 }), user); // Matches
actions.dispatch(Actions.UserUpdated({ Role: "admin", UserId: 10 }), user); // Matches
actions.dispatch(Actions.UserUpdated({ Role: "viewer", UserId: 5 }), user); // No match
```

### Subscribe with an empty controller (catch all)

```ts
actions.useAction(Actions.UserUpdated({}), handler);

actions.dispatch(Actions.UserUpdated({ UserId: 1 }), user); // Matches
actions.dispatch(Actions.UserUpdated({ UserId: 2 }), user); // Matches
```

### Subscribe to a plain action (no filter)

```ts
actions.useAction(Actions.UserUpdated, handler);

actions.dispatch(Actions.UserUpdated({ UserId: 5 }), user); // Matches every dispatch
actions.dispatch(Actions.UserUpdated, user); // Matches every dispatch
```

### Dispatch without a controller (broadcast to every handler)

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

`null` and `undefined` are explicitly forbidden as controller values.

## Multi-Property Channels

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
    context.actions.produce((draft) => void (draft.model.user = user));
  },
);

// Dispatch to all handlers matching the controller
actions.dispatch(Actions.UserUpdated({ OrgId: 42, Role: "admin" }), user);
```

## Real-World Example: Multi-User Dashboard

```tsx
import { Action, Distribution, Lifecycle } from "march-hare";
import { app } from "./app";

type User = { id: number; name: string; status: string };
type Model = { user: User | null };

class Actions {
  static Mount = Lifecycle.Mount();
  static UserUpdated = Action<User, { UserId: number }>(
    "UserUpdated",
    Distribution.Broadcast,
  );
}

// WebSocket connection component
function UserWebSocket() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Mount, (context) => {
    const ws = new WebSocket("/users/stream");

    ws.onmessage = (event) => {
      const user = JSON.parse(event.data) as User;
      // Dispatch to specific user's controller
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
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  // Only fires for this specific user's updates
  actions.useAction(
    Actions.UserUpdated({ UserId: userId }),
    (context, user) => {
      context.actions.produce((draft) => void (draft.model.user = user));
    },
  );

  return (
    <div>
      <h3>{view[0].user?.name}</h3>
      <span>{view[0].user?.status}</span>
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

// Fires ONLY when controller matches
actions.useAction(Actions.UserUpdated({ UserId: 1 }), (context, user) => {
  console.log("User 1 specifically updated");
});
```

When you dispatch to a plain action, both handlers fire. When you dispatch with a controller, only matching channeled handlers fire (plus plain handlers always fire).

## Summary

The subscriber's controller is the filter. Every key the subscriber supplies must be present and equal on the dispatch channel; extra keys on the dispatch channel are ignored. Uncalled actions on either side bypass channel filtering entirely.

| Dispatch                           | Subscriber                         | Fires?                                                       |
| ---------------------------------- | ---------------------------------- | ------------------------------------------------------------ |
| `Action`                           | any                                | Yes (uncalled dispatch is unfiltered)                        |
| `Action({...})`                    | `Action`                           | Yes (uncalled subscriber is unfiltered)                      |
| `Action({ Id: 5 })`                | `Action({ Id: 5 })`                | Yes (exact match)                                            |
| `Action({ Id: 5, Role: "admin" })` | `Action({ Id: 5 })`                | Yes (subscriber's filter is a subset)                        |
| `Action({ Id: 5 })`                | `Action({ Id: 5, Role: "admin" })` | No (subscriber asked for `Role`, dispatch did not supply it) |
| `Action({})`                       | `Action({ Id: 5 })`                | No (subscriber asked for `Id`, dispatch did not supply it)   |
