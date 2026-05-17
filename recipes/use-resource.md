# Resource

`Resource(fetcher)` declares a remote interaction at module scope. Components consume it via `useResource(handle)`, which returns the fetch callable directly &ndash; `await user()` triggers a request. The callable exposes two attached methods:

- `.if({ over })` &ndash; conditional refresh; fetch only if the cached payload is older than the supplied freshness window.
- `.else(fallback)` &ndash; synchronous read of the cached payload with a default for the "nothing cached yet" case.

Every call fires its own request. The most recent successful payload is cached in a module-level `WeakMap` keyed by the fetcher function itself, so `.if(...)` and `.else(...)` always have something to read from. A failed call doesn't disturb the cache.

```ts
// resources.ts
import { Resource } from "march-hare";

// `T` is inferred from the fetcher's return type — no generics needed.
export const user = Resource((signal) =>
  ky.get("user", { signal }).json<User>(),
);

export const pay = Resource((signal, body: Body) =>
  ky.post("pay", { json: body, signal }).json<Receipt>(),
);
```

```tsx
// actions.ts
import { useActions, useResource } from "march-hare";
import * as resource from "./resources";

export function useActions() {
  const user = useResource(resource.user);
  const pay = useResource(resource.pay);
  const actions = useActions<Model, typeof Actions>({
    user: user.else(null),
    receipt: pay.else(null),
  });

  actions.useAction(Actions.Mount, async (context) => {
    const data = await user.if(
      { over: { minutes: 5 } },
      context.task.controller.signal,
    );
    context.actions.produce(({ model }) => void (model.user = data));
  });

  actions.useAction(Actions.Submit, async (context, body) => {
    const receipt = await pay(context.task.controller.signal, body);
    context.actions.produce(({ model }) => void (model.receipt = receipt));
  });

  return actions;
}
```

Fetchers take a single `params` argument (defaults to `{}`) and return a `Promise<T>`. Resources do **not** carry any callbacks &mdash; side-effects (broadcasting, logging, model updates) belong in the `useAction` handler that called `await handle(...)`.

> **One primitive for reads and writes.** `Resource` doesn't distinguish GETs from POSTs. The cache and the freshness window apply uniformly. Every call fires its own request &mdash; no implicit coalescing &mdash; so accidental double-submits aren't masked. If you want a deliberate duplicate-submit guard, use `.if({ over })` explicitly.

> **Convention:** import resources as a namespace (`import * as resource`) so call sites read `resource.user`, `resource.pay`, etc. The grouping signals "remote interactions, declared at module scope" at a glance. The local binding then mirrors the resource &ndash; `const user = useResource(resource.user)`.

> **Temporal runtime requirement.** `.if({ over })` reads a `Temporal.Instant` internally. March Hare reads `Temporal` from the host global, so consumers targeting runtimes that do not yet expose it natively must install a polyfill (e.g. [`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill)) once at app entry.

## Passing params

The second generic on `Resource` types a single `params` object that the fetcher receives as its only argument. Defaults to no params, in which case the bound handle takes no arguments. With params declared, the call site requires them:

```ts
// resources.ts
type Params = { id: number };

export const user = Resource((signal, { id }: Params) =>
  ky.get(`users/${id}`, { signal }).json<User>(),
);

export const updateUser = Resource(
  (signal, { id, name }: { id: number; name: string }) =>
    ky.patch(`users/${id}`, { json: { name }, signal }).json<User>(),
);
```

```ts
// actions.ts
const user = useResource(resource.user);
//    ^ (params: Params) => Promise<User>; with .if, .else attached

const updateUser = useResource(resource.updateUser);
//    ^ (params: { id: number; name: string }) => Promise<User>; with .if, .else attached
```

Params are passed as a single object &mdash; not positional arguments. This keeps the call site self-documenting (`user({ id: 5 })` is clearer than `user(5)`).

## `.else(fallback)` &mdash; sync read of the cache

`.else(fallback)` reads the most recent successful payload synchronously, falling back to whatever you pass when nothing has resolved yet. Useful for seeding model state, rendering placeholder UI from a previous-session cache (if hydrated separately), or recovering from a failed refresh:

```ts
actions.useAction(Actions.Refresh, async (context) => {
  try {
    const data = await user();
    context.actions.produce(({ model }) => void (model.user = data));
  } catch {
    // Refresh failed — fall back to the last good value, or null.
    context.actions.produce(({ model }) => void (model.user = user.else(null)));
  }
});
```

The signature is `else<U>(fallback: U): T | U` &mdash; the fallback's type widens the return so the empty-case is always handled at the call site. There is no way to read the cache without supplying a default.

The cache slot is shared across components using the same Resource handle &mdash; whichever component runs the fetcher first populates the slot for everyone reading via `.else`.

## `.if({ over })` &mdash; conditional refresh

For "refresh, but don't bother if we just ran" semantics, call `.if({ over })`:

```ts
const user = useResource(resource.user);

actions.useAction(Actions.Refresh, async (context) => {
  const data = await user.if({ over: { minutes: 5 } });
  context.actions.produce(({ model }) => void (model.user = data));
});
```

`over` accepts a `Temporal.Duration`, a `DurationLike` object (`{ minutes: 5 }`, `{ seconds: 30 }`), or an ISO 8601 duration string (`"PT5M"`). If the most recent successful run resolved longer ago than the window, the fetcher is called. Otherwise the cached data is returned without hitting the network.

```ts
await user.if({ over: { minutes: 5 } });
await user.if({ over: "PT5M" });
await user.if({ over: Temporal.Duration.from({ minutes: 5 }) });
```

For parameterised resources, params come after the options object:

```ts
const data = await feed.if({ over: { minutes: 1 } }, { cursor });
```

The freshness check uses the resource's module-scoped timestamp, which reflects the most recent successful call across all param-sets. For parameterised resources, a fresh `feed({ cursor: null })` will short-circuit a subsequent `feed.if({ over: { minutes: 5 } }, { cursor: "page-2" })`. Treat it as "did _anyone_ run this resource recently?", not "did we run _these params_ recently".

`.if` is also useful as an explicit duplicate-submit guard for writes &mdash; `await pay.if({ over: { seconds: 5 } }, body)` will only fire if the last successful `pay` was more than five seconds ago. The cached receipt may not match the current intent, so use this deliberately.

## Fanning out on success or failure

Resources don't dispatch anything themselves. Compose dispatch (and any other side-effects) in the calling handler &mdash; the same place the `await` lives:

```ts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await user();
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

> **Note:** TypeScript cannot type promise rejections, so `await handle(...)` rejects with `unknown`. To narrow inline, use `error instanceof YourErrorClass` checks within a `try/catch` block in the handler.

## Optimistic updates

The canonical pattern for a write that updates the model: annotate the field as pending, fire the call, swap in the server response (or roll back on failure):

```ts
import { Op } from "march-hare";

actions.useAction(Actions.Rename, async (context, name) => {
  const previous = context.model.user;
  context.actions.produce(({ model }) => {
    model.user = context.actions.annotate({ ...model.user!, name }, Op.Update);
  });

  try {
    const updated = await updateUser({ id: previous!.id, name });
    context.actions.produce(({ model }) => void (model.user = updated));
  } catch (error) {
    context.actions.produce(({ model }) => void (model.user = previous));
    throw error;
  }
});
```

Pending state drives the UI via `actions.inspect.user.pending()` &mdash; see [model-annotations.md](./model-annotations.md). Nothing on the `Resource` itself participates in the optimistic flow; the handler owns the rollback because the handler is what knows the previous value.

## Run semantics

Every awaited call triggers a fresh network request. There is **no in-flight coalescing** &ndash; calling `user()` three times concurrently produces three requests. Coordination across components happens at the broadcast layer (see above), not at a hidden cache.

```ts
const a = user({ id: 5 });
const b = user({ id: 5 });
const c = user({ id: 5 });
// Three network requests.

const d = user({ id: 6 });
// A fourth, with different params.
```

Each successful response updates the module-scope cache for that fetcher; whichever resolves last wins. Refresh is a synonym for "call the handle again" &ndash; no `invalidate()`, no second function to import.

## Three-tier error handling

Errors can be handled at three layers, each with a distinct responsibility:

```tsx
// Tier 1: dispatch a typed broadcast in the calling handler — every listener reacts
actions.useAction(Actions.Mount, async (context) => {
  try {
    const data = await user();
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
actions.useAction(Actions.Submit, async (context, body) => {
  try {
    const receipt = await pay(body);
    context.actions.produce(({ model }) => void (model.receipt = receipt));
  } catch (error) {
    if (error instanceof InsufficientFundsError) {
      context.actions.produce(({ model }) => void (model.declined = true));
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

Pick the lowest tier that suits the concern. Routine, expected failures (404 means "deleted", "insufficient funds" means "show the error inline") belong in tier 2. Authentication and network-level failures usually belong in tier 3. Tier 1 is for events other components need to react to without awaiting the resource themselves. See [error-handling.md](./error-handling.md) for the global fault contract.

## Mount-time pattern

The canonical pattern is to call `await user()` from a `Lifecycle.Mount` handler and write the result into the model:

```ts
actions.useAction(Actions.Mount, async (context) => {
  context.actions.produce(
    ({ model }) =>
      void (model.user = context.actions.annotate(
        model.user,
        Operation.Update,
      )),
  );

  const data = await user();

  context.actions.produce(({ model }) => void (model.user = data));
});
```

The `annotate` call drives the loading UI via `actions.inspect.user.pending()` &ndash; see [model-annotations.md](./model-annotations.md). Refresh has the same body &ndash; just call the handle again, no invalidate step.

## Infinite scroll

Variadic fetchers are how you build pagination. Declare the cursor as a param, pass it at call time, append each page into the model:

```ts
// resources.ts
type Params = { cursor: string | null };

export const feed = Resource((signal, { cursor }: Params) =>
  http
    .get("feed", { searchParams: { cursor: cursor ?? "" }, signal })
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
  const feed = useResource(resource.feed);
  const actions = useActions<Model, typeof Actions>({
    items: [],
    cursor: null,
    hasMore: true,
  });

  actions.useAction(Actions.Mount, async (context) => {
    const page = await feed({ cursor: null });
    context.actions.produce(({ model }) => {
      model.items = page.items;
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  actions.useAction(Actions.LoadMore, async (context) => {
    if (!context.model.hasMore) return;
    const page = await feed({ cursor: context.model.cursor });
    context.actions.produce(({ model }) => {
      model.items.push(...page.items);
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  return actions;
}
```

There's no in-flight coalescing &ndash; clicking "load more" twice rapidly fires two requests. Guard against duplicate dispatches with a `pending()` check or by gating on `model.hasMore` / `model.cursor` movement. See the live `/transactions` example at [`src/example/transactions/`](../src/example/transactions/) for the IntersectionObserver pattern.

## Seeding the initial model with `.else`

Because `useResource` is a standalone hook, you can call it _before_ `useActions` and feed the cached value into the initial model literal:

```ts
const cat = useResource(resources.cat);
const actions = useActions<Model, typeof Actions, Data>(
  { cat: cat.else(null) },
  () => ({ index, router }),
);

actions.useAction(Actions.Mount, async (context) => {
  const fresh = await cat.if({ over: { minutes: 5 } });
  context.actions.produce(({ model }) => void (model.cat = fresh));
});
```

`cat.else(null)` reads the cached payload synchronously &ndash; if a previous mount (or another component using the same Resource) populated the cache, the model starts with that value rather than `null`. The mount handler then refreshes lazily via `.if`.

## Limitations

- **No persistence across reloads.** A hard reload starts every Resource fresh.
- **No focus or reconnect revalidation.** Wire a `window` listener and call the handle again if you need this.
- **No SSR isolation.** The cache `WeakMap` is module-global, so server-side rendering would leak across requests. `Resource` is client-only.
- **No subscription on the awaiter.** `await user()` resolves once and does not re-fire when the broadcast goes out. Use a `useAction(broadcastAction)` handler in consuming components for change notifications.
- **`.else` is not reactive.** Reading it inside render does not subscribe the component to updates &mdash; it is a snapshot, not a signal. Drive UI from the model.
