# Caching async results

Chizu provides a built-in cache layer for deduplicating and reusing async results across action handlers. The cache is shared across all components within a `<Boundary>`.

## Defining cache operations

Use the `Cache` factory to create cache operations with a TTL (time-to-live) in milliseconds:

```ts
import { Cache } from "chizu";

export class CacheStore {
  static User = Cache<{ UserId: number }>(30_000); // 30s TTL, channeled
  static Config = Cache(60_000); // 60s TTL, unchanneled
}
```

Cache operations follow the same channel pattern as actions. The generic type parameter defines the channel shape for keyed lookups. Channel values must be non-nullable primitives (`string`, `number`, `bigint`, `boolean`, or `symbol`).

## Putting values into the cache

Inside an action handler, call `context.actions.cache.put()` with a cache operation and an async callback. The callback receives a `cache` function &mdash; call `cache(value)` to store the value before returning it. If you don't call `cache`, nothing is stored:

```ts
actions.useAction(Actions.LoadUser, async (context, userId) => {
  const user = await context.actions.cache.put(
    CacheStore.User({ UserId: userId }),
    async (cache) => {
      const response = await fetch(`/api/users/${userId}`);
      return response.ok ? cache(await response.json()) : null;
    },
  );

  context.actions.produce(({ model }) => {
    model.user = user;
  });
});
```

On cache hit, `cache.put` returns `T` synchronously &mdash; the callback is never called. On miss, it runs the callback and returns `Promise<T>`. Using `await` handles both cases uniformly.

## Reading cached values

Use `context.actions.cache.get()` to synchronously read a cached value without triggering a fetch. Returns `undefined` if no entry exists or the entry has expired:

```ts
actions.useAction(Lifecycle.Mount, (context) => {
  const user = context.actions.cache.get<User>(CacheStore.User({ UserId: 5 }));

  if (user) {
    context.actions.produce(({ model }) => {
      model.user = user;
    });
  }
});
```

This is useful for hydrating model fields from the cache on mount, where you have full access to dynamic values such as route parameters via `context.data`.

## Deleting cache entries

Call `context.actions.cache.delete()` to remove cache entries:

```ts
actions.useAction(Actions.UpdateUser, async (context, payload) => {
  await fetch(`/api/users/${payload.id}`, { method: "PUT", body: ... });

  // Delete the specific user's cache (partial channel match)
  context.actions.cache.delete(CacheStore.User({ UserId: payload.id }));
});
```

### Partial channel matching

Deletion uses partial channel matching. A channeled deletion removes all entries whose stored channel contains the specified keys:

```ts
// Given cached entries for:
// { UserId: 5, Role: "admin" }
// { UserId: 5, Role: "user" }
// { UserId: 10, Role: "admin" }

// Delete all entries for UserId 5 (both Role variants)
context.actions.cache.delete(CacheStore.User({ UserId: 5 }));

// Delete all admin entries (UserId 5 and 10)
context.actions.cache.delete(CacheStore.User({ Role: "admin" }));

// Delete ALL user cache entries regardless of channel
context.actions.cache.delete(CacheStore.User);
```
