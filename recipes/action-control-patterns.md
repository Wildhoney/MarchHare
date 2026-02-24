# Action control patterns

You can implement common patterns manually using `context.signal` and standard JavaScript:

## Cancellation with `context.signal`

Every action receives an `AbortSignal` via `context.signal`. Use it to cancel in-flight requests when the component unmounts or when actions are aborted:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  const response = await fetch(`/search?q=${query}`, {
    signal: context.signal,
  });
  // ...
});
```

## Timeouts

Implement timeouts using `AbortSignal.timeout()` combined with `context.signal`:

```ts
actions.useAction(Actions.FetchData, async (context) => {
  const response = await fetch("/api/data", {
    signal: AbortSignal.any([context.signal, AbortSignal.timeout(5_000)]),
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
    if (delay > 0) await utils.sleep(delay, context.signal);
    try {
      const response = await fetch("/api/data", { signal: context.signal });
      return await response.json();
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError;
});
```

## Debouncing and throttling

Use `utils.sleep` with the abort signal to debounce &ndash; when a new dispatch occurs, the previous sleep is aborted automatically:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  await utils.sleep(300, context.task.controller.signal); // Debounce delay
  const results = await fetch(`/search?q=${query}`, {
    signal: context.task.controller.signal,
  });
  // ...
});
```

Dispatch the action on every keystroke &ndash; the sleep will be aborted when a new dispatch occurs, effectively debouncing the search.
