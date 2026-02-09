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

## Using cacheable in handlers

Inside an action handler, call `context.actions.cacheable()` with a cache operation and an async callback. The callback receives a `cache` function &mdash; call `cache(value)` to store the value before returning it. If you don't call `cache`, nothing is stored:

```ts
actions.useAction(Actions.LoadUser, async (context, userId) => {
  const user = await context.actions.cacheable(
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

On cache hit, `cacheable` returns `T` synchronously &mdash; the callback is never called. On miss, it runs the callback and returns `Promise<T>`. Using `await` handles both cases uniformly.

## Model initialisation with cache

Use the `cache()` helper to initialise model fields from the cache store with a fallback:

```ts
import { cache } from "chizu";

const model: Model = {
  user: cache(CacheStore.User({ UserId: 5 }), null),
};
```

When `useActions` processes the model, it resolves cache markers against the store. If a cached value exists and is within TTL, it is used; otherwise the fallback is used.

## Invalidating cache entries

Call `context.actions.invalidate()` to remove cache entries:

```ts
actions.useAction(Actions.UpdateUser, async (context, payload) => {
  await fetch(`/api/users/${payload.id}`, { method: "PUT", body: ... });

  // Invalidate the specific user's cache (partial channel match)
  context.actions.invalidate(CacheStore.User({ UserId: payload.id }));
});
```

### Partial channel matching

Invalidation uses partial channel matching. A channeled invalidation removes all entries whose stored channel contains the specified keys:

```ts
// Given cached entries for:
// { UserId: 5, Role: "admin" }
// { UserId: 5, Role: "user" }
// { UserId: 10, Role: "admin" }

// Invalidate all entries for UserId 5 (both Role variants)
context.actions.invalidate(CacheStore.User({ UserId: 5 }));

// Invalidate all admin entries (UserId 5 and 10)
context.actions.invalidate(CacheStore.User({ Role: "admin" }));

// Invalidate ALL user cache entries regardless of channel
context.actions.invalidate(CacheStore.User);
```
