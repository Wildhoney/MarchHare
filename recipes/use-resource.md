# Resource

`Resource` declares a remote resource at module scope &ndash; same shape as `Action`. Components consume it via `actions.useResource(handle)` to obtain a frozen `{ run, data, at }` object: `run()` triggers a fresh network call, while `data` and `at` are read-only snapshots of the most recent successful payload and when it resolved.

```ts
// resources.ts
import { Resource } from "march-hare";

export const user = Resource("user", () => ky.get("/api/user").json<User>());
```

```tsx
// actions.ts
import * as marchHare from "march-hare";
import * as resource from "./resources";

export function useActions() {
  const actions = marchHare.useActions<Model, typeof Actions>(initialModel);
  const user = actions.useResource(resource.user);

  actions.useAction(Actions.Mount, async (context) => {
    const data = await user.run();
    context.actions.produce(({ model }) => void (model.user = data));
  });

  return actions;
}
```

`Resource(key, fetcher)` returns a `ResourceHandle<T, P>`. The fetcher takes a single `params` argument and returns a `Promise<T>` &mdash; nothing else. No callbacks, no injected `dispatch`. Any side-effects you want after a run (broadcasting, analytics, model updates) belong in the `useAction` handler that awaited `user.run(...)`. Keeping the resource a thin promise wrapper means call sites read top-to-bottom: fetch, dispatch, update.

> **Convention:** import resources as a namespace (`import * as resource`) so call sites read `resource.user`, `resource.feed`, etc. The grouping signals "remote data, declared at module scope" at a glance. The local binding then mirrors the resource &ndash; `const user = actions.useResource(resource.user)`.

> **Temporal runtime requirement.** `at` is a `Temporal.Instant`. March Hare reads `Temporal` from the host global, so consumers targeting runtimes that do not yet expose it natively must install a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) once at app entry.

## Passing params

The second generic on `Resource` types a single `params` object that the fetcher receives as its only argument. Defaults to no params, in which case `run()` takes no arguments. With params declared, the call site requires them:

```ts
// resources.ts
type Params = { id: number };

export const user = Resource<User, Params>("user", ({ id }) =>
  ky.get(`/api/users/${id}`).json<User>(),
);
```

```ts
// actions.ts
const user = actions.useResource(resource.user);
//    ^ { run: (params: Params) => Promise<User>; data: User | null; at: Temporal.Instant | null }

actions.useAction(Actions.Mount, async (context) => {
  const data = await user.run({ id: props.id });
  context.actions.produce(({ model }) => void (model.user = data));
});
```

Params are passed as a single object &mdash; not positional arguments. This keeps the call site self-documenting (`run({ id: 5 })` is clearer than `run(5)`) and means in-flight dedup keys per param shape without needing tuple comparison.

## Fanning out on success or failure

Resources don't dispatch anything themselves. Compose dispatch (and any other side-effects) in the calling handler &mdash; the same place the `await` lives:

```ts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await user.run();
    await context.actions.dispatch(Actions.Broadcast.UserUpdated, data);
    context.actions.produce(({ model }) => void (model.user = data));
  } catch (error) {
    if (error instanceof RateLimitedError) {
      await context.actions.dispatch(
        Actions.Broadcast.RateLimited,
        error.retryAfter,
      );
    }
    throw error;
  }
});
```

When several components need to react to a resource update, the natural pattern is: one component awaits the run and dispatches the broadcast; every other component subscribes to that broadcast via `useAction`. See [broadcast-actions.md](./broadcast-actions.md) for the receiving side &ndash; late-mounting components automatically pick up the cached broadcast value.

> **Note:** TypeScript cannot type promise rejections, so `await user.run()` rejects with `unknown`. To narrow inline, use `error instanceof YourErrorClass` checks within a `try/catch` block in the handler.

## Run semantics

Every awaited `run()` call triggers a fresh network request. There is **no memoised result** &ndash; calling `await user.run()` twice in sequence makes two network requests. Coordination across components happens at the broadcast layer (see above), not at a hidden cache.

Concurrent calls with the same params share one in-flight request:

```ts
const a = user.run({ id: 5 });
const b = user.run({ id: 5 });
const c = user.run({ id: 5 });
// Single network request; a, b, c all resolve to the same value.

const d = user.run({ id: 6 });
// Separate request — different params, separate in-flight slot.
```

Once a promise resolves, the next call runs anew. Refresh is a synonym for "call `run()` again" &ndash; no `invalidate()`, no second function to import.

## `data` and `at`

Alongside `run`, the hook returns two read-only snapshots:

- **`data`** &ndash; the most recently resolved payload, or `null` before the first successful run.
- **`at`** &ndash; the `Temporal.Instant` at which `data` last updated, or `null`.

Both are module-scoped on the `ResourceHandle`, so two components reading the same `Resource` see the same values &ndash; whichever component runs first populates the snapshot for everyone.

```ts
const user = actions.useResource(resource.user);

actions.useAction(Actions.Refresh, async (context) => {
  // Skip if we ran in the last 30 seconds.
  if (user.at) {
    const elapsed = Temporal.Now.instant().since(user.at).total("seconds");
    if (elapsed < 30) return;
  }
  await user.run();
});
```

A failed run does **not** clobber `data` or `at` &ndash; the last good value sticks around until the next successful call.

### Conditional run with `run.if({ over })`

For "refresh, but don't bother if we just ran" semantics, call `run.if({ over })`:

```ts
const user = actions.useResource(resource.user);

actions.useAction(Actions.Refresh, async (context) => {
  const data = await user.run.if({ over: { minutes: 5 } });
  context.actions.produce(({ model }) => void (model.user = data));
});
```

`over` accepts a `Temporal.Duration`, a `DurationLike` object (`{ minutes: 5 }`, `{ seconds: 30 }`), or an ISO 8601 duration string (`"PT5M"`). If the most recent successful run resolved longer ago than the window, `run(...)` is called. Otherwise the cached data is returned without hitting the network.

```ts
await user.run.if({ over: { minutes: 5 } });
await user.run.if({ over: "PT5M" });
await user.run.if({ over: Temporal.Duration.from({ minutes: 5 }) });
```

For parameterised resources, params come after the options object:

```ts
const data = await feed.run.if({ over: { minutes: 1 } }, { cursor });
```

The freshness check uses the resource's module-scoped `at` instant, which reflects the most recent successful call across all param-sets. For parameterised resources, a fresh `feed.run({ cursor: null })` will short-circuit a subsequent `feed.run.if({ over: { minutes: 5 } }, { cursor: "page-2" })`. Treat it as "did _anyone_ run this resource recently?", not "did we run _these params_ recently".

> **`data` and `at` are non-reactive.** Reading them does not subscribe the component to updates. Drive UI from the model (write the payload into `model` after `await user.run()`) or from a broadcast subscription &ndash; `data` is a snapshot, not a signal.

For parameterised resources, `data` and `at` reflect the most recent successful call regardless of which param-set it used. Treat them as "latest result", not "result for these params".

## Three-tier error handling

Errors can be handled at three layers, each with a distinct responsibility:

```tsx
// Tier 1: dispatch a typed broadcast in the calling handler — every listener reacts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await user.run();
    context.actions.produce(({ model }) => void (model.user = data));
  } catch (error) {
    if (error instanceof RateLimitedError) {
      await context.actions.dispatch(
        Actions.Broadcast.RateLimited,
        error.retryAfter,
      );
    }
    throw error;
  }
});

// Tier 2: handler-level inline recovery — branch on a specific error
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await user.run();
    context.actions.produce(({ model }) => void (model.user = data));
  } catch (error) {
    if (error instanceof ForbiddenError) {
      context.actions.produce(({ model }) => void (model.locked = true));
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

| Tier               | Use for                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| Handler `dispatch` | Cross-component reactions to fresh failures &ndash; toast, retry banner, analytics    |
| `try/catch`        | Component-specific recovery where the error becomes part of the model state           |
| `Lifecycle.Fault`  | App-level concerns &ndash; sign-out on auth failure, sentry reporting, abort cascades |

Pick the lowest tier that suits the concern. Routine, expected failures (404 means "deleted") belong in tier 2. Authentication and network-level failures usually belong in tier 3. Tier 1 is for events other components need to react to without awaiting the resource themselves. See [error-handling.md](./error-handling.md) for the global fault contract.

## Mount-time pattern

The canonical pattern is to call `await user.run()` from a `Lifecycle.Mount` handler and write the result into the model:

```ts
actions.useAction(Actions.Mount, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.user = context.actions.annotate(
        Operation.Update,
        model.user,
      )),
  );

  const data = await user.run();

  context.actions.produce(({ model }) => void (model.user = data));
});
```

The `annotate` call drives the loading UI via `actions.inspect.user.pending()` &ndash; see [model-annotations.md](./model-annotations.md). Refresh has the same body &ndash; just call `await user.run()` again, no invalidate step.

## Infinite scroll

Variadic fetchers are how you build pagination. Declare the cursor as a param, pass it at call time, append each page into the model:

```ts
// resources.ts
type Params = { cursor: string | null };

export const feed = Resource<Page<Item>, Params>("feed", ({ cursor }) =>
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

export function useActions() {
  const actions = marchHare.useActions<Model, typeof Actions>({
    items: [],
    cursor: null,
    hasMore: true,
  });
  const feed = actions.useResource(resource.feed);

  actions.useAction(Actions.Mount, async (context) => {
    const page = await feed.run({ cursor: null });
    context.actions.produce(({ model }) => {
      model.items = page.items;
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  actions.useAction(Actions.LoadMore, async (context) => {
    if (!context.model.hasMore) return;
    const page = await feed.run({ cursor: context.model.cursor });
    context.actions.produce(({ model }) => {
      model.items.push(...page.items);
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  return actions;
}
```

In-flight dedup keys per params shape, so clicking "load more" twice rapidly with the same cursor produces a single run &ndash; both clicks resolve to the same page, only one gets appended. Different cursors run concurrently and never collide.

For an IntersectionObserver-driven scroll trigger plus a `pending()` guard against duplicate dispatches, see the live `/transactions` example at [`src/example/transactions/`](../src/example/transactions/) &ndash; mock paginated API, five pages, "you've reached the end" sentinel.

## Why `actions.useResource` instead of a free hook?

Putting `useResource` on the `actions` tuple keeps the surface consistent &ndash; both `useAction` and `useResource` are methods on the same tuple. Mirroring `useAction`'s shape means handlers, resources, and reactive `data` all reach for the same object.

## Limitations

- **No persistence across reloads.** A hard reload starts every Resource fresh.
- **No focus or reconnect revalidation.** Wire a `window` listener and call `run()` again if you need this.
- **No SSR isolation.** The `inflight` field on each Resource is module-global, so server-side rendering would leak across requests. `Resource` is client-only.
- **No subscription on the awaiter.** `await user.run()` resolves once and does not re-fire when the broadcast goes out. Use a `useAction(broadcastAction)` handler in consuming components for change notifications.
- **`data` and `at` are not reactive.** Reading them inside render does not subscribe the component to updates &ndash; they are snapshots, not signals. Drive UI from the model.
