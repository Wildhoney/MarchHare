# Action regulator

The action regulator lets handlers control which actions may be dispatched across all components within a `<Boundary>`. Use it to lock down the UI during critical operations, implement permission gates, or prevent actions while an important workflow is in progress.

## API

Every action handler receives `context.regulator` with two methods:

```ts
context.regulator.disallow(); // Block all actions
context.regulator.disallow(Actions.Fetch, Actions.Save); // Block specific actions
context.regulator.allow(); // Allow all actions (reset)
context.regulator.allow(Actions.Critical); // Allow only specific actions
```

Each call **replaces** the previous policy entirely (last-write-wins). There is no stacking or merging of policies.

For "except" patterns, compose two calls:

```ts
// Block all except Critical (allow only Critical)
context.regulator.allow(Actions.Critical);

// Allow all except Fetch (block only Fetch)
context.regulator.disallow(Actions.Fetch);
```

## How it works

The regulator stores a single mutable policy object shared via React context across all components in a `<Boundary>`. The policy is checked **before** task creation, so blocked actions never allocate resources (no `AbortController`, no context object).

When an action is blocked, the regulator:

1. Constructs a `Fault` with `reason: Reason.Disallowed` and a `DisallowedError`.
2. Fires the global `<Error>` handler (if present).
3. Fires the local `Lifecycle.Error()` handler (if registered).
4. Returns early &ndash; the action handler is never called.

## Policy modes

| Call                | Behaviour                             |
| ------------------- | ------------------------------------- |
| `allow()` (default) | Every action is permitted             |
| `disallow()`        | Every action is blocked               |
| `disallow(A, B)`    | Only the listed actions are blocked   |
| `allow(A, B)`       | Only the listed actions are permitted |

## Examples

### Lock the UI during checkout

```ts
actions.useAction(Actions.Checkout, async (context) => {
  // Allow only the cancel action during checkout
  context.regulator.allow(Actions.Cancel);

  try {
    await processPayment(context.task.controller.signal);
  } finally {
    // Re-allow all actions regardless of success or failure
    context.regulator.allow();
  }
});
```

### Permission gate on mount

```ts
actions.useAction(Actions.Mount, async (context) => {
  const user = await context.actions.read(Actions.Broadcast.User);
  if (!user) return;

  if (user.role !== "admin") {
    // Non-admin users can only view, not modify
    context.regulator.allow(Actions.Broadcast.User);
  }
});
```

### Blocking specific expensive actions

```ts
actions.useAction(Actions.RateLimitHit, (context) => {
  // Temporarily block the expensive actions
  context.regulator.disallow(
    Actions.Search,
    Actions.Export,
    Actions.BulkUpdate,
  );
});

actions.useAction(Actions.RateLimitCleared, (context) => {
  context.regulator.allow();
});
```

### Handling blocked actions

```ts
actions.useAction(Actions.Error, (context, fault) => {
  if (fault.reason === Reason.Disallowed) {
    context.actions.produce(({ model }) => {
      model.error = "This action is currently unavailable.";
    });
  }
});
```

## Lifecycle actions

The regulator applies to **all** actions, including lifecycle actions (`Lifecycle.Mount()`, `Lifecycle.Update()`, etc.). If you block everything with `disallow()`, lifecycle actions will also be blocked. Use `allow` with specific actions to carve out essentials:

```ts
// Allow only mount and unmount, block everything else
context.regulator.allow(Actions.Mount, Actions.Unmount);
```

## Scope

The policy is scoped to the nearest `<Boundary>` (or `<Regulators>` provider). Components in different boundaries have independent policies. If you need isolated regulation for a library, wrap it in its own `<Regulators>`:

```tsx
import { Regulators } from "chizu";

function MyLibrary({ children }) {
  return <Regulators>{children}</Regulators>;
}
```

See the [context providers recipe](./context-providers.md) for more details on provider isolation.
