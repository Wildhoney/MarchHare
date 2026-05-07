# Resource

`Resource` declares a remote resource at module scope &ndash; same shape as `Action`. Components consume it via `actions.useResource(handle)` to obtain a thunk that fetches fresh data on every call.

```ts
// resources.ts
import { Resource } from "chizu";

export const user = Resource("user", () => ky.get("/api/user").json<User>());
```

```tsx
// actions.ts
import * as resource from "./resources";

function useUserActions() {
  const actions = useActions<Model, typeof Actions>(initialModel);
  const fetchUser = actions.useResource(resource.user);

  actions.useAction(Actions.Mount, async (context) => {
    const data = await fetchUser();
    context.actions.produce(({ model }) => {
      model.user = data;
    });
  });

  return actions;
}
```

`Resource(key, fetcher, onSuccess?, onError?)` returns a `ResourceHandle<T, E>`. Pass that handle to `actions.useResource` and you get a `() => Promise<T>` bound to the surrounding `<Boundary>`'s broadcaster and the component's reactive `data`.

> **Convention:** import resources as a namespace (`import * as resource`) so call sites read `resource.user`, `resource.cat(id)`, etc. The grouping signals "remote data, declared at module scope" at a glance.

## Fetch semantics

Every awaited call triggers a fresh fetch. There is **no stale cache** &ndash; calling `await fetchUser()` twice in sequence makes two network requests. Coordination across components happens at the broadcast layer (see below), not at a hidden cache.

Concurrent calls share one in-flight request:

```ts
const a = fetchUser();
const b = fetchUser();
const c = fetchUser();
// Single network request; a, b, c all resolve to the same value.
```

Once the promise resolves, the next call fetches anew. Refresh is a synonym for "call the thunk again" &ndash; no `invalidate()`, no second function to import.

## Subscriptions via `onSuccess`

The third argument fires after every successful fetch. It receives a `context` object with three properties:

- **`context.response`** &ndash; the fetched value, typed `T`.
- **`context.data`** &ndash; the reactive `data` proxy of the component that triggered the fetch, same shape as `context.data` inside handlers.
- **`context.dispatch`** &ndash; a pre-bound dispatcher for the surrounding Boundary's broadcaster, restricted to broadcast and channeled-broadcast actions.

```ts
export const user = Resource(
  "user",
  () => ky.get("/api/user").json<User>(),
  ({ response, dispatch }) => dispatch(Actions.Broadcast.UserUpdated, response),
);
```

`dispatch` is restricted at the type level to `BroadcastPayload<P>` and `ChanneledAction<P, C>`. Unicast and multicast actions are rejected by the compiler &ndash; resource-level events have no owning component to scope them to.

The natural pattern is: one component awaits the fetch, every other component listens to the broadcast and updates its own model in response. See [broadcast-actions.md](./broadcast-actions.md) for the receiving side &ndash; late-mounting components automatically pick up the cached broadcast value, so there is no need for a resource-level cache.

## Typed errors via `onError`

The fourth argument fires on every failed fetch. It receives a `context` with `error`, `data`, and `dispatch`. The second generic on `Resource` types `context.error`, so when your fetcher throws a typed hierarchy (typically from your HTTP client &ndash; see [ky-http-client.md](./ky-http-client.md)) you can narrow with `instanceof` cleanly:

```ts
export const user = Resource<User, ApiError>(
  "user",
  () => http.get("user").json<User>(),
  ({ response, dispatch }) => dispatch(Actions.Broadcast.UserUpdated, response),
  ({ error, dispatch }) => {
    if (error instanceof RateLimitedError) {
      dispatch(Actions.Broadcast.RateLimited, error.retryAfter);
    } else if (error instanceof ForbiddenError) {
      dispatch(Actions.Broadcast.AccessDenied);
    }
  },
);
```

The awaiter's promise still rejects with the original value, so try/catch and a global `Lifecycle.Fault` subscriber continue to work &ndash; the subscription is purely additive.

> **Note:** TypeScript cannot type promise rejections, so `await fetchUser()` itself still rejects with `unknown`. The typing only narrows the `onError` callback. To recover inline, narrow within a `try/catch` block in the handler.

## Three-tier error handling

Errors can be handled at three layers, each with a distinct responsibility:

```tsx
// Tier 1: resource-level fan-out — broadcast a typed event to every listener
export const user = Resource<User, ApiError>(
  "user",
  () => http.get("user").json<User>(),
  undefined,
  ({ error, dispatch }) => {
    if (error instanceof RateLimitedError) {
      dispatch(Actions.Broadcast.RateLimited, error.retryAfter);
    }
  },
);

// Tier 2: handler-level inline recovery — branch on a specific error
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await fetchUser();
    context.actions.produce(({ model }) => {
      model.user = data;
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      context.actions.produce(({ model }) => {
        model.locked = true;
      });
      return;
    }
    throw error; // bubble to the boundary
  }
});

// Tier 3: Lifecycle.Fault — global catch-all
const actions = useActions();
actions.useAction(Lifecycle.Fault, (_context, { reason, error, tasks }) => {
  if (reason !== Reason.Errored) return;
  if (error instanceof UnauthorisedError) {
    for (const task of tasks) task.controller.abort();
    redirectToLogin();
  }
});
```

| Tier              | Use for                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `onError`         | Cross-component reactions to fresh failures &ndash; toast, retry banner, analytics    |
| try/catch         | Component-specific recovery where the error becomes part of the model state           |
| `Lifecycle.Fault` | App-level concerns &ndash; sign-out on auth failure, sentry reporting, abort cascades |

Pick the lowest tier that suits the concern. Routine, expected failures (404 means "deleted") belong in tier 2. Authentication and network-level failures usually belong in tier 3. Tier 1 is for events other components need to react to without awaiting the resource themselves. See [error-handling.md](./error-handling.md) for the global fault contract.

## Mount-time pattern

The canonical pattern is to call `await fetchUser()` from a `Lifecycle.Mount` handler and write the result into the model:

```ts
actions.useAction(Actions.Mount, async (context) => {
  context.actions.produce(({ model }) => {
    model.user = context.actions.annotate(Operation.Update, model.user);
  });

  const data = await fetchUser();

  context.actions.produce(({ model }) => {
    model.user = data;
  });
});
```

The `annotate` call drives the loading UI via `actions.inspect.user.pending()` &ndash; see [model-annotations.md](./model-annotations.md). Refresh has the same body &ndash; just call `await fetchUser()` again, no invalidate step.

## Parameterised resources

The fetcher may take arguments. The thunk returned by `actions.useResource` forwards them, and in-flight dedup keys per arg-tuple &ndash; so concurrent calls with the same args share a request, while different args run independently.

```ts
// resources.ts
export const user = Resource(
  "user",
  (id: number) => ky.get(`/api/users/${id}`).json<User>(),
  ({ response, dispatch }) => dispatch(Actions.Broadcast.UserUpdated, response),
);
```

```ts
// actions.ts
const fetchUser = actions.useResource(resource.user);
//    ^ (id: number) => Promise<User>

actions.useAction(Actions.Mount, async (context) => {
  const data = await fetchUser(props.id);
  context.actions.produce(({ model }) => {
    model.user = data;
  });
});
```

The fetcher's signature flows through TypeScript &ndash; if you write `(id: number, opts: Options) => ...`, the thunk is typed `(id: number, opts: Options) => Promise<T>`. No need to specify the args generic explicitly.

## Infinite scroll

Variadic fetchers are how you build pagination. Pass the cursor at call time, append the response into the model:

```ts
// resources.ts
export const feed = Resource("feed", (cursor: string | null) =>
  http
    .get("feed", { searchParams: { cursor: cursor ?? "" } })
    .json<Page<Item>>(),
);
```

```ts
// actions.ts
type Model = {
  items: Item[];
  cursor: string | null;
  hasMore: boolean;
};

export function useFeedActions() {
  const actions = useActions<Model, typeof Actions>({
    items: [],
    cursor: null,
    hasMore: true,
  });
  const fetchFeed = actions.useResource(resource.feed);

  actions.useAction(Actions.Mount, async (context) => {
    const page = await fetchFeed(null);
    context.actions.produce(({ model }) => {
      model.items = page.items;
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  actions.useAction(Actions.LoadMore, async (context) => {
    if (!context.model.hasMore) return;
    const page = await fetchFeed(context.model.cursor);
    context.actions.produce(({ model }) => {
      model.items.push(...page.items);
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  return actions;
}
```

In-flight dedup means clicking "load more" twice rapidly with the same cursor produces a single fetch &ndash; both clicks resolve to the same page, only one gets appended. Different cursors run concurrently and never collide.

For an IntersectionObserver-driven scroll trigger plus a `pending()` guard against duplicate dispatches, see the live `/transactions` example at [`src/example/transactions/`](../src/example/transactions/) &ndash; mock paginated API, five pages, "you've reached the end" sentinel.

## Why `actions.useResource` instead of a free hook?

Putting `useResource` on the `actions` tuple gives the Resource's callbacks access to this component's reactive `data` proxy &ndash; the same proxy you read inside handlers via `context.data`. Without that, the callback would have no way to reach component-scoped values without a closure-and-ref dance. Mirroring `actions.useAction`'s shape keeps the surface consistent &ndash; both hooks are methods on the same tuple.

## Limitations

- **No persistence across reloads.** A hard reload starts every Resource fresh.
- **No focus or reconnect revalidation.** Wire a `window` listener and call the thunk again if you need this.
- **No SSR isolation.** The `inflight` field on each Resource is module-global, so server-side rendering would leak across requests. `Resource` is client-only.
- **No subscription on the awaiter.** `await fetchUser()` resolves once and does not re-fire when the broadcast goes out. Use a `useAction(broadcastAction)` handler in consuming components for change notifications.
