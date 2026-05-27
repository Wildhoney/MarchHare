# Store

The `Store` is a per-`<Boundary>` typed record of cross-cutting, mutable state. It holds whatever doesn't belong in the model &mdash; session tokens, locale, feature flags, current operational mode &mdash; anything ambient that handlers read on every call and that `Resource` fetchers need without explicit threading.

Reads are plain dot notation (`store.session`); writes go through `context.actions.produce(({ store }) => { store.x = ... })`, the same Immer-style recipe used for the model. There are no `.get`/`.set`/`.read` methods.

Every Store key flows into three places automatically:

- **`useStore()`** &mdash; the hook-level read-only handle (Proxy; dot reads are always fresh).
- **`context.store`** &mdash; the same handle inside `useActions` handlers.
- **`store` field** on every `Resource` fetcher's args object &mdash; a snapshot per `.run()` call.

Store is **not** reactive. Mutating it does not trigger a re-render. Drive view state through the model; reach for the Store when you need cross-handler coordination or auth-style ambient values.

## Declaring the shape

The Store's shape is declared once via TypeScript module augmentation. The library exports an empty `Store` interface; consumer code adds keys to it:

```ts
// app/store.ts
import type { Session } from "./auth/types";

declare module "march-hare" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Store {
    session: Session | null;
    locale: string;
    operating: "idle" | "signing-out";
  }
}
```

The `interface` form is mandatory &mdash; TypeScript's declaration merging only works with interfaces, not type aliases. If your project enforces `@typescript-eslint/consistent-type-definitions: type`, suppress the rule on the augmentation block (as shown).

## Wiring the initial value

Pass the initial Store to `<Boundary store={...}>`:

```tsx
<Boundary store={{ session: null, locale: "en-GB", operating: "idle" }}>
  <App />
</Boundary>
```

The provided object is held by reference inside the Boundary; writes through `context.actions.produce(({ store }) => ...)` replace it with a fresh object via Immer. Nested Boundaries can supply their own Store, scoping it to that subtree.

If you omit the `store` prop the Store defaults to `{}` &mdash; useful for tests or for apps that don't need ambient state.

## Reading via dot notation

```ts
import { useStore } from "march-hare";

function useAuthActions() {
  const store = useStore();
  const actions = useActions<void, typeof Actions>();

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.store.operating === "signing-out") return;
    if (context.store.session === null) return;
    // ...
  });

  return actions;
}
```

`store.session`, `context.store.locale` &mdash; whatever you declared in the augmented interface. The handle is a `Proxy` that delegates to the live ref, so dot reads always reflect the latest write, even after `await` boundaries.

`context.store` is the same Proxy as `useStore()`, just available inside handlers without re-binding at the hook level.

## Writing via `context.actions.produce`

Writes happen inside an action handler through the same `produce` mechanism the model uses:

```ts
actions.useAction(Actions.SignIn, async (context, credentials) => {
  const result = await context.actions.resource(signIn(credentials));
  context.actions.produce(({ store }) => {
    store.session = result;
    store.operating = "idle";
  });
});

actions.useAction(Actions.SignOut, async (context) => {
  context.actions.produce(({ store }) => {
    store.operating = "signing-out";
  });
  await context.actions.resource(signOut());
  context.actions.produce(({ store }) => {
    store.session = null;
    store.operating = "idle";
  });
});
```

The `store` draft is an Immer draft &mdash; deep mutations work naturally:

```ts
context.actions.produce(({ store }) => {
  store.session = { accessToken: "abc", refreshToken: "def" };
  // Or mutate in place:
  store.session.accessToken = "xyz";
});
```

Both model and store live in the same produce callback, so you can mutate them atomically when needed:

```ts
context.actions.produce(({ model, store }) => {
  model.user = { ...model.user!, name: "Adam" };
  store.operating = "idle";
});
```

Model mutations re-render; Store mutations don't.

### Writes outside handlers are blocked

`useStore()` returns a read-only Proxy. Direct assignment throws:

```ts
const store = useStore();
store.session = result;
// TypeError: Store is read-only outside `context.actions.produce`.
```

This is a deliberate guard. If you need to set the Store during component setup or outside an action flow, dispatch an action that does it &mdash; that keeps every Store mutation traceable through the action log.

## Resource fetchers receive the Store

Every fetcher's args object includes a `store` field &mdash; a snapshot of the Store at the moment the fetcher is invoked:

```ts
export const user = Resource<User, { id: number }>(
  ({ store, controller, params }) =>
    ky
      .get(`users/${params.id}`, {
        headers: store.session
          ? { Authorization: `Bearer ${store.session.accessToken}` }
          : {},
        signal: controller.signal,
      })
      .json<User>(),
);
```

The `store` snapshot is read once per fetcher invocation, so a single fetch sees a consistent view. If the Store changes between calls, the next fetch picks up the new value.

## Reactivity caveats

The Store is **not** a React state primitive. Mutations:

- Do **not** trigger re-renders of components that called `useStore()`.
- Do **not** notify subscribers (broadcast actions are the right tool for that).
- Become visible to the **next** read of any handler, fetcher, or hook that reads the Store.

If a component needs to render based on a Store value, lift the value into the model (or fire a broadcast action when it changes and subscribe via `useAction`). The Store is for the _handler_ side of your app, not the view side.

## Why Store rather than threading via `useActions` data callback

Before Store, the canonical pattern for ambient values like the session token was:

```ts
const session = useSessionContext();
const actions = useActions<Model, typeof Actions, { session: Session | null }>(
  model,
  () => ({ session }),
);
```

Threading via the data callback works but has three downsides Store fixes:

- **Resources can't read it.** Resources are module-scope and have no React context, so the data callback never reaches them. The pre-Store workaround was a holder module (with all the global-mutable concerns that brings) plus a `ky.beforeRequest` hook.
- **Every hook re-declares the shape.** Each `useActions` call needed `{ session: ... }` in the generics.
- **The model literal can't see it.** The `data` callback fires after the model is built.

Store solves all three: the type is declared once globally, the fetcher receives a snapshot for free, and reads compose naturally inside hooks and handlers.

## Limitations

- **Module-scope shape.** The augmented `Store` interface is process-global. SSR setups that need per-request data should scope via per-request Boundaries with distinct `store` props rather than relying on a shared module declaration.
- **Not for view state.** If you mutate the Store and want the UI to update, you've reached for the wrong primitive &mdash; use a model field with a broadcast for cross-component reactions instead.
- **Snapshots, not subscriptions.** A Resource fetcher reads `store` once at the start of each `.run()`. If the Store changes mid-flight, the in-flight fetch keeps its original snapshot.
