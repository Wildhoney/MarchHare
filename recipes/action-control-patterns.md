# Action control patterns

You can implement common patterns manually using `context.task.controller.signal` and standard JavaScript:

## Cancellation with `context.task.controller.signal`

Every action receives an `AbortSignal` via `context.task.controller.signal`. Use it to cancel in-flight requests when the component unmounts or when actions are aborted:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  const response = await fetch(`/search?q=${query}`, {
    signal: context.task.controller.signal,
  });
  // ...
});
```

## Timeouts

Implement timeouts using `AbortSignal.timeout()` combined with `context.task.controller.signal`:

```ts
actions.useAction(Actions.FetchData, async (context) => {
  const response = await fetch("/api/data", {
    signal: AbortSignal.any([
      context.task.controller.signal,
      AbortSignal.timeout(5_000),
    ]),
  });
  // ...
});
```

## Retry logic

Implement retries with a simple loop:

```ts
actions.useAction(Actions.FetchData, async (context) => {
  const intervals = [1_000, 2_000, 4_000];
  let lastError: Error | null = null;

  for (const delay of [0, ...intervals]) {
    if (delay > 0) await utils.sleep(delay, context.task.controller.signal);
    try {
      const response = await fetch("/api/data", {
        signal: context.task.controller.signal,
      });
      return await response.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError;
});
```

## Debouncing and throttling

Re-dispatching an action does **not** abort the previous in-flight handler &ndash; each dispatch is an independent task, and only unmount aborts a task automatically. To debounce, abort the sibling tasks of the same action yourself at the top of the handler, then let the abort signal cancel each superseded sleep:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  for (const task of context.tasks) {
    if (task !== context.task && task.action === context.task.action) {
      task.controller.abort();
    }
  }

  await utils.sleep(300, context.task.controller.signal); // Debounce delay
  const results = await fetch(`/search?q=${query}`, {
    signal: context.task.controller.signal,
  });
  // ...
});
```

Dispatch the action on every keystroke: each firing aborts the previous one's sleep before its own delay elapses, so only the last change in a burst survives to the fetch. The aborted firings surface as `Reason.Aborted` faults.
