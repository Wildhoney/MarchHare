# Filtered Actions

Filtered actions allow targeted event delivery by subscribing with a filter object. This pattern is ideal for components that only care about updates relevant to them.

## Basic Usage

Subscribe with a filter object using tuple syntax:

```tsx
import { useActions, Action } from "chizu";

class Actions {
  static UserUpdated = Action<User>("UserUpdated");
}

function UserCard({ userId }: { userId: number }) {
  const actions = useActions<Model, typeof Actions>(model);

  // Only fires when dispatched with matching filter
  actions.useAction(
    [Actions.UserUpdated, { UserId: userId }],
    (context, user) => {
      context.actions.produce((draft) => {
        draft.model.user = user;
      });
    },
  );

  return <div>{actions[0].user?.name}</div>;
}
```

## Filter Matching

The filter is an object where each key-value pair must match. By convention, use **uppercase keys** (e.g., `{UserId: 4}` not `{userId: 4}`) to distinguish filter keys from payload properties.

### Dispatch with exact filter

```ts
// Only handlers with matching UserId fire
actions.dispatch([Actions.UserUpdated, { UserId: 5 }], user);
```

### Dispatch with subset filter (fan out)

```ts
// Fires ALL handlers where Role === "admin"
// Matches: {Role: "admin"}, {Role: "admin", UserId: 5}, {Role: "admin", UserId: 10}
actions.dispatch([Actions.UserUpdated, { Role: "admin" }], user);
```

### Dispatch with empty filter

```ts
// Fires ALL filtered handlers (no constraints)
actions.dispatch([Actions.UserUpdated, {}], user);
```

### Broadcast dispatch (all handlers)

```ts
// ALL handlers fire: plain handlers AND all filtered handlers
actions.dispatch(Actions.UserUpdated, user);
```

## Filter Value Types

Filter values support non-nullable primitives:

```ts
// Number (user IDs, entity IDs)
actions.useAction([Actions.Update, { UserId: 123 }], handler);

// String (UUIDs, slugs, roles)
actions.useAction(
  [Actions.Update, { Role: "admin", Slug: "abc-def" }],
  handler,
);

// Boolean (feature flags)
actions.useAction([Actions.Update, { Active: true }], handler);

// Symbol (unique identifiers)
const myKey = Symbol("my-key");
actions.useAction([Actions.Update, { Key: myKey }], handler);
```

`null` and `undefined` are explicitly forbidden as filter values.

## Multi-Property Filters

Filters can have multiple properties for precise targeting:

```ts
// Subscribe to updates for admin users in a specific org
actions.useAction(
  [Actions.UserUpdated, { OrgId: props.orgId, Role: "admin" }],
  (context, user) => {
    context.actions.produce((draft) => {
      draft.model.user = user;
    });
  },
);

// Dispatch to all handlers matching the filter
actions.dispatch([Actions.UserUpdated, { OrgId: 42, Role: "admin" }], user);
```

## Real-World Example: Multi-User Dashboard

```tsx
import { useActions, Action, Lifecycle, Distribution } from "chizu";

type User = { id: number; name: string; status: string };
type Model = { user: User | null };

class Actions {
  static UserUpdated = Action<User>("UserUpdated", Distribution.Broadcast);
}

// WebSocket connection component
function UserWebSocket() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Lifecycle.Mount, (context) => {
    const ws = new WebSocket("/users/stream");

    ws.onmessage = (event) => {
      const user = JSON.parse(event.data) as User;
      // Dispatch to specific user's filter
      context.actions.dispatch(
        [Actions.UserUpdated, { UserId: user.id }],
        user,
      );
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
    [Actions.UserUpdated, { UserId: userId }],
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

You can subscribe to both plain and filtered handlers for the same action:

```ts
// Fires for ALL UserUpdated dispatches (including filtered ones)
actions.useAction(Actions.UserUpdated, (context, user) => {
  console.log("Any user updated:", user.id);
});

// Fires ONLY when filter matches
actions.useAction([Actions.UserUpdated, { UserId: 1 }], (context, user) => {
  console.log("User 1 specifically updated");
});
```

When you dispatch to a plain action, both handlers fire. When you dispatch with a filter, only matching filtered handlers fire (plus plain handlers always fire).

## Summary

| Dispatch Pattern                              | Handlers That Fire                      |
| --------------------------------------------- | --------------------------------------- |
| `dispatch(Action, payload)`                   | ALL handlers (plain + all filtered)     |
| `dispatch([Action, {}], payload)`             | All filtered handlers                   |
| `dispatch([Action, { Key: value }], payload)` | Filtered handlers where `Key === value` |
