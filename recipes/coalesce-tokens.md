# Coalesce tokens

`.coalesce()` on its own is usually enough: every caller for the same Resource + same params joins one in-flight fetch. Reach for a token argument only when you need to split callers of the **same** Resource and **same** params into separate coalesce groups &mdash; for example, when a feature has both an "initial load" path and a "refresh" path and they must not share.

The dedupe key is the triple `(Resource, params, token)`. Two calls share a fetch only when all three match. With no token (`.coalesce()`), every untokened caller for the same `(Resource, params)` slot collapses onto a shared default; with a token, the token becomes part of the key.

## When to reach for a token

Most real applications never need this. Suspect a token only when:

- A single Resource is consumed by two distinct flows that genuinely should not piggy-back. For example: the dashboard widget refreshes on a 60-second timer; the user clicking "Refresh now" forces a fresh fetch. If the user-driven refresh happens to land during a timer-driven fetch, they should NOT share.
- You want to avoid `.coalesce()`-on-mount accidentally being joined by an unrelated `.coalesce()` somewhere else in the tree.

If neither applies, prefer plain `.coalesce()` &mdash; it's simpler and is what the README documents.

## Defining the token

Use a numeric enum. The values are opaque at runtime (the library stringifies them internally) so any unique primitive works, but a typed enum gives call sites a greppable, refactor-friendly name:

```ts
// scope/coalesce.ts — one per scope is plenty.
export enum Coalesce {
  InitialLoad,
  ManualRefresh,
}
```

## Applying the token

```ts
import { Coalesce } from "./coalesce";
import * as resource from "./resources";

actions.useAction(Actions.Mount, async (context) => {
  // Joined by any other Mount-driven load via the same token.
  const user = await context.actions
    .resource(resource.user())
    .coalesce(Coalesce.InitialLoad);
  context.actions.produce(({ model }) => void (model.user = user));
});

actions.useAction(Actions.Refresh, async (context) => {
  // Independent of the initial-load group, so an in-flight Mount fetch
  // does not get re-resolved with stale data when the user hits Refresh.
  const user = await context.actions
    .resource(resource.user())
    .coalesce(Coalesce.ManualRefresh);
  context.actions.produce(({ model }) => void (model.user = user));
});
```

## Allowed token types

- `string`, `number`, `bigint`, `boolean`, `symbol` &mdash; preferred. Stringification is straightforward and stable.
- `object` &mdash; serialised with `JSON.stringify`. Avoid this unless you have a specific reason; non-stable key order in the object will silently break the dedupe.

The token is keyed structurally by its primitive value (for `symbol`, by `description`). Two `Symbol("X")` instances from different modules share a coalesce group if their descriptions match &mdash; usually convenient, occasionally surprising.

## Things to know

- **Tokens scope coalesce groups, not subscribers.** A token only controls which dispatchers join the same in-flight promise. Subscribers via `useAction` and the per-params cache slot are unaffected by the token.
- **Don't pass the same token across unrelated Resources.** The dedupe key includes the Resource identity, so `context.actions.resource(resource.user()).coalesce(Coalesce.X)` and `context.actions.resource(resource.cat()).coalesce(Coalesce.X)` are independent &mdash; but reading two unrelated Resources with the same token is still confusing for the next person reading the code.
- **`.exceeds(...)` composes with `.coalesce(...)`.** Apply both: `.exceeds({ minutes: 5 }).coalesce(Coalesce.InitialLoad)`. The cache-freshness short-circuit runs first; if the fetch goes ahead, the coalesce group applies.
- **No global registry.** A scope's token namespace is local to the call sites that import the enum. Keep tokens close to the code that uses them; library-wide enums are not the move.

See the [mount-broadcast deduplication recipe](./mount-broadcast-deduplication.md) for the most common reason `.coalesce()` exists at all &mdash; deduping a mount-time fetch against a replayed broadcast handler.
