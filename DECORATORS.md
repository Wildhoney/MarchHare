# Removed Decorators

This document lists the middleware/decorators that were removed from Chizu for future reimplementation.

## Middleware Functions (via `Use` object)

These were passed as additional arguments to `actions.useAction()`:

```ts
actions.useAction(
  Actions.Search,
  async (context, query) => {
    /* handler */
  },
  Use.Debounce(300),
  Use.Supplant(),
);
```

### Use.Supplant()

Ensures only one instance of an action runs at a time. When dispatched again, the previous instance is aborted via `context.signal`.

**Use case:** Search inputs where only the latest request matters.

```ts
actions.useAction(
  Actions.Fetch,
  async (context, id) => {
    const data = await fetch(`/api/${id}`, { signal: context.signal });
    // ...
  },
  Use.Supplant(),
);
```

### Use.Debounce(ms)

Delays action execution until no new dispatches occur for the specified duration. The timer resets on each call.

**Use case:** Search inputs, form validation, auto-save functionality.

```ts
actions.useAction(
  Actions.Search,
  (context, query) => {
    /* ... */
  },
  Use.Debounce(300),
);
```

### Use.Throttle(ms)

Limits action execution to at most once per specified time window. First call executes immediately, subsequent calls during cooldown are queued.

**Use case:** Scroll handlers, resize handlers, rate-limited updates.

```ts
actions.useAction(
  Actions.Scroll,
  (context, position) => {
    /* ... */
  },
  Use.Throttle(100),
);
```

### Use.Retry(intervals?)

Automatically retries failed actions with specified delay intervals. Respects the abort signal and stops retrying if aborted.

**Default intervals:** `[1000, 2000, 4000]` (exponential backoff)

**Use case:** Network requests that may fail transiently.

```ts
// Default exponential backoff
actions.useAction(
  Actions.Fetch,
  async (context, id) => {
    /* ... */
  },
  Use.Retry(),
);

// Custom intervals
actions.useAction(
  Actions.Fetch,
  async (context, id) => {
    /* ... */
  },
  Use.Retry([100, 500, 1000]),
);
```

### Use.Timeout(ms)

Aborts the action if it exceeds the specified duration. Triggers the abort signal for graceful cleanup.

**Use case:** Preventing long-running requests from blocking the UI.

```ts
actions.useAction(
  Actions.Fetch,
  async (context, id) => {
    /* ... */
  },
  Use.Timeout(5000),
);
```

### Use.Reactive(getDependencies, getPayload?)

Automatically triggers an action when primitive dependencies change. Uses checksum comparison for change detection.

**Use case:** Auto-triggering searches when a search term changes.

```ts
actions.useAction(
  Actions.Search,
  async (context, query) => {
    /* ... */
  },
  Use.Reactive(
    (ctx) => [ctx.model.searchTerm],
    (ctx) => ctx.model.searchTerm,
  ),
);
```

### Use.Poll(interval, getPayload?, getStatus?)

Automatically triggers an action at regular intervals. Supports pause/play via `getStatus` returning `Status.Pause` or `Status.Play`.

**Use case:** Polling for updates, refresh timers.

```ts
actions.useAction(
  Actions.Refresh,
  async (context) => {
    /* ... */
  },
  Use.Poll(5000, undefined, (ctx) =>
    ctx.model.isPaused ? Status.Pause : Status.Play,
  ),
);
```

## Middleware Composition

Middleware were applied in order (first middleware is outermost):

```ts
actions.useAction(
  Actions.Fetch,
  async (context, id) => {
    const data = await fetch(`/api/${id}`, { signal: context.signal });
    return data.json();
  },
  Use.Supplant(), // 1. Cancel previous request
  Use.Retry([500, 1000]), // 2. Retry on failure
  Use.Timeout(5000), // 3. Abort if too slow
);
```

## Related Types Removed

- `Middleware` - The middleware interface with `name` and `wrap` function
- `MiddlewareHandler` - Handler function signature for middleware
- `Status` enum - `Status.Play` and `Status.Pause` for poll control
- `ReactiveEntry` - Reactive binding configuration
- `PollEntry` - Poll binding configuration
- `SnapshotContext` - Context for reactive/poll callbacks

## Related Error Types (kept but updated)

- `Reason.Timedout` - When action exceeded timeout
- `Reason.Supplanted` - When action was cancelled by a newer dispatch
- `AbortError` - Generic abort error
- `TimeoutError` - Timeout error

## Manual Alternatives

Until middleware is reimplemented, these patterns can be achieved manually:

### Cancellation

Use `context.signal` directly:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  const response = await fetch(`/search?q=${query}`, {
    signal: context.signal,
  });
  // ...
});
```

### Timeout

Use `AbortSignal.timeout()`:

```ts
actions.useAction(Actions.FetchData, async (context) => {
  const response = await fetch("/api/data", {
    signal: AbortSignal.any([context.signal, AbortSignal.timeout(5_000)]),
  });
  // ...
});
```

### Retry

Implement with a loop:

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

### Debounce

Use sleep with abort:

```ts
actions.useAction(Actions.Search, async (context, query) => {
  await utils.sleep(300, context.signal);
  const results = await fetch(`/search?q=${query}`, { signal: context.signal });
  // ...
});
```
