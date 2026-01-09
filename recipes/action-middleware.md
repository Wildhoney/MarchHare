# Action middleware

Chizu provides middleware for adding common behaviors to action handlers. Pass middleware as additional arguments after the handler:

```ts
import { useActions, Use } from "chizu";

export function useSearchActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(
    Actions.Search,
    async (context, query) => {
      const results = await fetch(`/search?q=${query}`, {
        signal: context.signal,
      });
      // ...
    },
    Use.Debounce(300), // Wait 300ms after last call
    Use.Supplant(), // Cancel previous in-flight request
  );

  return actions;
}
```

## Available middleware

| Middleware                            | Description                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Use.Supplant()`                      | Cancels the previous in-flight handler when a new dispatch arrives. Useful for search inputs where only the latest request matters. |
| `Use.Debounce(ms)`                    | Delays execution until no new dispatches occur for the specified duration. The timer resets on each call.                           |
| `Use.Throttle(ms)`                    | Limits execution to at most once per time window. First call executes immediately, subsequent calls during cooldown are queued.     |
| `Use.Retry(intervals)`                | Retries failed handlers with configurable delays. Defaults to exponential backoff `[1000, 2000, 4000]`. Respects the abort signal.  |
| `Use.Timeout(ms)`                     | Aborts the handler if it exceeds the specified duration. Triggers the abort signal for graceful cleanup.                            |
| `Use.Reactive(getDeps, getPayload)`   | Auto-triggers when primitive dependencies change. Uses checksum comparison for change detection.                                    |
| `Use.Poll(ms, getPayload, getStatus)` | Auto-triggers at regular intervals. Supports pause/play via `getStatus` returning `Status.Pause` or `Status.Play`.                  |

## Combining middleware

Middleware are applied in order (first middleware is outermost). This matters for certain combinations:

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

In this example:

1. `Use.Supplant()` wraps everything, so a new dispatch cancels the entire retry sequence
2. `Use.Retry()` wraps the timeout, so each retry attempt has its own 5s limit
3. `Use.Timeout()` applies to the handler directly

## Examples

**Search with debounce and supplant:**

```ts
actions.useAction(
  Actions.Search,
  async (context, query) => {
    const results = await fetch(`/search?q=${query}`, {
      signal: context.signal,
    });
    context.actions.produce((draft) => {
      draft.model.results = await results.json();
    });
  },
  Use.Debounce(300),
  Use.Supplant(),
);
```

**API call with retry and timeout:**

```ts
actions.useAction(
  Actions.FetchData,
  async (context, id) => {
    const response = await fetch(`/api/data/${id}`, {
      signal: context.signal,
    });
    if (!response.ok) throw new Error("Failed to fetch");
    // ...
  },
  Use.Retry([1000, 2000, 4000]),
  Use.Timeout(10000),
);
```

**Scroll handler with throttle:**

```ts
actions.useAction(
  Actions.Scroll,
  (context, position) => {
    context.actions.produce((draft) => {
      draft.model.scrollPosition = position;
    });
  },
  Use.Throttle(100),
);
```

**Auto-trigger on dependency change:**

```ts
actions.useAction(
  Actions.Search,
  async (context, query) => {
    const results = await fetch(`/search?q=${query}`);
    context.actions.produce((draft) => {
      draft.model.results = await results.json();
    });
  },
  Use.Reactive(
    (ctx) => [ctx.model.searchTerm],
    (ctx) => ctx.model.searchTerm,
  ),
  Use.Supplant(),
);
```

**Polling with pause control:**

```ts
actions.useAction(
  Actions.Refresh,
  async (context) => {
    const data = await fetch("/api/data");
    context.actions.produce((draft) => {
      draft.model.data = await data.json();
    });
  },
  Use.Poll(5000, undefined, (ctx) =>
    ctx.model.isPaused ? Status.Pause : Status.Play,
  ),
);
```
