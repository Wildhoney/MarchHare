# Caching expensive data

Chizu provides a lightweight, TTL-based cache that lives inside action handlers. The cache is scoped to the nearest `<Boundary>` and operates on an explicit cache-or-fetch basis &ndash; no automatic save/restore hooks.

## Entry definition

Define a class of typed cache entries using `Entry`. Each call to `Entry()` produces a unique identity, and the first type parameter binds it to a value type:

```ts
import { Entry } from "chizu";

type CryptoPair = { base: string; quote: string };
type User = { id: number; name: string };

class CacheStore {
  // Unchanneled &mdash; single cache slot
  static Pairs = Entry<CryptoPair[]>();

  // Channeled &mdash; independent slot per UserId
  static User = Entry<User, { UserId: number }>();
}
```

The second type parameter follows the same channel convention as actions &ndash; an object of non-nullable primitives with uppercase keys.

## Basic usage with Option

Use `context.actions.cacheable` inside a handler. If a non-expired value exists for the entry, it is returned immediately and the callback is **not** called. Otherwise the callback runs, and its result is unwrapped and stored:

```ts
import { O } from "@mobily/ts-belt";

actions.useAction(Actions.FetchPairs, async (context) => {
  const { data } = await context.actions.cacheable(
    CacheStore.Pairs,
    30_000, // TTL in milliseconds
    async () => O.Some(await api.fetchPairs()),
  );

  if (data) {
    context.actions.produce(({ model }) => {
      model.pairs = data;
    });
  }
});
```

The callback must return a `Promise<Option<T>>` or `Promise<Result<T, E>>`. Only `Some` / `Ok` values are stored; `None` / `Error` results are skipped and `{ data: null }` is returned.

## Usage with Result

When using `Result`, return `Ok(value)` to cache or `Error(reason)` to skip:

```ts
import { R } from "@mobily/ts-belt";

actions.useAction(Actions.FetchUser, async (context) => {
  const { data } = await context.actions.cacheable(
    CacheStore.User({ UserId: context.data.userId }),
    60_000,
    async () => {
      try {
        return R.Ok(await api.fetchUser(context.data.userId));
      } catch {
        return R.Error("fetch failed");
      }
    },
  );

  if (data) {
    context.actions.produce(({ model }) => {
      model.user = data;
    });
  }
});
```

## Unwrap rules

Exactly one layer of `Option` or `Result` is unwrapped before storage:

| Callback returns  | Stored value | `data`    |
| ----------------- | ------------ | --------- |
| `Some("hello")`   | `"hello"`    | `"hello"` |
| `None`            | &mdash;      | `null`    |
| `Ok(42)`          | `42`         | `42`      |
| `Error("bad")`    | &mdash;      | `null`    |
| `Ok(Ok(42))`      | `Ok(42)`     | `Ok(42)`  |
| `Some(Some("x"))` | `"x"`        | `"x"`     |

Since ts-belt&rsquo;s `Option<T>` is `T | null | undefined`, `Some(x)` is simply `x`. Wrapping a `Result` in `Some` stores the `Result` as-is.

## Channeled entries

Channeled entries produce independent cache slots per channel value:

```ts
// Each user has their own cached data
CacheStore.User({ UserId: 5 });
CacheStore.User({ UserId: 10 });
```

Different channel values never collide. This is useful for per-entity caching (users, products, routes).

## Invalidation

Use `context.actions.invalidate` to remove a cached value so the next `cacheable` call fetches fresh data:

```ts
actions.useAction(Actions.RefreshUser, (context) => {
  context.actions.invalidate(CacheStore.User({ UserId: context.data.userId }));
  context.actions.dispatch(Actions.FetchUser);
});

// Unchanneled
context.actions.invalidate(CacheStore.Pairs);
```

## TTL behaviour

- The TTL is specified per `cacheable` call in milliseconds.
- A cached value is considered valid while `Date.now() < expiry`.
- When the TTL expires, the next `cacheable` call runs the callback and replaces the entry.
- Calling `invalidate` removes the entry entirely, regardless of remaining TTL.

## Boundary scoping

The cache is scoped to the nearest `<Boundary>`. Each boundary provides its own isolated cache, so entries in one boundary will not leak into another:

```tsx
import { Boundary } from "chizu";

<Boundary>
  {/* These components share a cache */}
  <Dashboard />
  <Sidebar />
</Boundary>

<Boundary>
  {/* Separate cache &mdash; fully isolated */}
  <Widget />
</Boundary>
```

## Abort safety

If the current action is aborted before `cacheable` is called (e.g. the component unmounted), `cacheable` returns `{ data: null }` immediately without executing the callback. This prevents stale writes after cancellation.
