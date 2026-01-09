# Action regulator

The regulator is accessed via `context.regulator` inside your action handlers. It provides fine-grained control over asynchronous actions by managing `AbortController` instances and action policies. You can programmatically allow or disallow actions, and abort running actions across all components in the context.

## Usage

```ts
actions.useAction(Actions.Fetch, async (context) => {
  // Disallow future dispatches of these actions
  context.regulator.policy.disallow.matching([Actions.Fetch, Actions.Save]);

  // Future dispatches via actions.useAction will be aborted immediately
  // and the error handler will receive Reason.Disallowed
});

actions.useAction(Actions.Reset, async (context) => {
  // Allow the actions again
  context.regulator.policy.allow.matching([Actions.Fetch, Actions.Save]);
});
```

You can also abort running actions:

```ts
// Abort specific actions across all components
context.regulator.abort.matching([Actions.Fetch]);

// Abort all actions across all components
context.regulator.abort.all();

// Abort only the current action instance
context.regulator.abort.self();
```

## API

**Abort methods:**

- `abort.all()` — Aborts all running actions across all components in the context.
- `abort.matching(actions)` — Aborts specific actions (array) across all components.
- `abort.self()` — Aborts only the current action instance.
- `abort.own()` — Aborts all actions belonging to the current component only (called automatically on unmount).

**Allow methods:**

- `policy.allow.all()` — Clears all disallow policies across all components.
- `policy.allow.matching(actions)` — Allows specific actions (array) across all components.
- `policy.allow.self()` — Allows the current action.
- `policy.allow.own()` — Clears all disallow policies belonging to the current component only.

**Disallow methods:**

- `policy.disallow.all()` — Clears all allow policies across all components.
- `policy.disallow.matching(actions)` — Disallows specific actions (array) across all components.
- `policy.disallow.self()` — Disallows the current action.
- `policy.disallow.own()` — Clears all allow policies belonging to the current component only.

The regulator is useful for advanced scenarios where you need to centrally manage cancellation and permission of asynchronous actions, such as rate limiting, feature toggling, or global aborts.
