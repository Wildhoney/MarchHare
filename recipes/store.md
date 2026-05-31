# Store

The `Store` is a per-`<app.Boundary>` typed record of cross-cutting, mutable state. It holds whatever doesn't belong in the model &mdash; session tokens, locale, feature flags, current operational mode &mdash; anything ambient that handlers read on every call and that `Resource` fetchers need without explicit threading.

Reads are plain dot notation (`store.session`); writes go through `context.actions.produce(({ store }) => { store.x = ... })`, the same Immer-style recipe used for the model. There are no `.get`/`.set`/`.read` methods.

Every Store key flows into three places automatically:

- **`app.useStore()`** &mdash; the hook-level read-only handle (Proxy; dot reads are always fresh).
- **`context.store`** &mdash; the same handle inside `useActions` handlers.
- **`store` field** on every `app.Resource` fetcher's args object &mdash; a snapshot per `.run()` call.

Store is **not** reactive. Mutating it does not trigger a re-render. Drive view state through the model; reach for the Store when you need cross-handler coordination or auth-style ambient values.

## Declaring the shape

The Store's shape is owned by an `App` instance. `App({ store })` infers the shape from the initial-value object, and every hook the App returns is typed against it:

```ts
// app.ts
import { App } from "march-hare";
import type { Session } from "./auth/types";

export const app = App({
  store: {
    session: null as Session | null,
    locale: "en-GB",
    operating: "idle" as "idle" | "signing-out",
  },
});
```

Different `<app.Boundary>` instances in the same tree can be backed by different `App` calls with completely independent shapes &mdash; the `Store` type is no longer process-global.

## Wiring the initial value

Render the App's Boundary at the root:

```tsx
import { app } from "./app";

<app.Boundary>
  <Root />
</app.Boundary>;
```

The initial value lives on the App; the Boundary delivers it to the subtree. Writes through `context.actions.produce(({ store }) => ...)` replace the slot with a fresh object via Immer.

## Reading via dot notation

```ts
import { app } from "./app";

export function useActions() {
  const store = app.useStore();
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.store.operating === "signing-out") return;
    if (context.store.session === null) return;
    // ...
  });

  return actions;
}
```

`store.session`, `context.store.locale` &mdash; whatever you declared on `App({ store })`. The handle is a `Proxy` that delegates to the live ref, so dot reads always reflect the latest write, even after `await` boundaries.

`context.store` is the same Proxy as `app.useStore()`, just available inside handlers without re-binding at the hook level.

## Writing via `context.actions.produce`

Writes happen inside an action handler through the same `produce` mechanism the model uses:

```ts
import * as resource from "../resources";

actions.useAction(Actions.SignIn, async (context, credentials) => {
  const signIn = await context.actions.resource(resource.signIn(credentials));
  context.actions.produce(({ store }) => {
    store.session = signIn;
    store.operating = "idle";
  });
});

actions.useAction(Actions.SignOut, async (context) => {
  context.actions.produce(({ store }) => {
    store.operating = "signing-out";
  });
  await context.actions.resource(resource.signOut());
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

`app.useStore()` returns a read-only Proxy. Direct assignment throws:

```ts
const store = app.useStore();
store.session = result;
// TypeError: Store is read-only outside `context.actions.produce`.
```

This is a deliberate guard. If you need to set the Store during component setup or outside an action flow, dispatch an action that does it &mdash; that keeps every Store mutation traceable through the action log.

## Resource fetchers receive the Store

Every fetcher's args object includes a `store` field &mdash; a snapshot of the Store at the moment the fetcher is invoked, typed against the App's shape:

```ts
export const user = app.Resource<User, { id: number }>({
  fetch({ store, controller, params }) {
    return ky
      .get(`users/${params.id}`, {
        headers: store.session
          ? { Authorization: `Bearer ${store.session.accessToken}` }
          : {},
        signal: controller.signal,
      })
      .json<User>();
  },
});
```

The `store` snapshot is read once per fetcher invocation, so a single fetch sees a consistent view. If the Store changes between calls, the next fetch picks up the new value.

## Reactivity caveats

The Store is **not** a React state primitive. Direct `app.useStore()` reads do not re-render components when the Store changes &mdash; the hook returns a Proxy that delegates to the live ref. Use the Store for the _handler_ side of your app where dot reads inside handlers and fetchers are always fresh.

For the view side, subscribe to `Lifecycle.Store` &mdash; a singleton broadcast that fires every time `produce` mutates the Store. It delivers the full latest snapshot to every subscriber in the surrounding `<app.Boundary>`, and seeds with the initial Store so late mounters see the current value on mount:

```ts
actions.useAction(Lifecycle.Store, (_context, store) => {
  // runs every time produce({ store }) changes the slot
});
```

Render directly against the Store in JSX without lifting it into the model:

```tsx
{
  actions.stream(Lifecycle.Store, (store) => <span>{store.locale}</span>);
}
```

`Lifecycle.Store` does **not** fire when a `produce` call mutates only the model &mdash; the slot reference is checked after each `produce` and the broadcast is emitted only when it changes. See [lifecycle-actions.md](./lifecycle-actions.md#lifecyclestore-global-broadcast) for the full contract.

## Multiple Stores

Because the shape is owned by `App({ store })`, an application can host several Boundaries with completely independent shapes:

```ts
// admin.ts
export const admin = App({ store: { permissions: [] as Permission[] } });

// public.ts
export const pub = App({ store: { locale: "en-GB" } });
```

Each `<admin.Boundary>` / `<pub.Boundary>` subtree gets its own typed handles; there is no shared module-augmented `Store` type.

## Limitations

- **Not for view state.** If you mutate the Store and want the UI to update, you've reached for the wrong primitive &mdash; use a model field with a broadcast for cross-component reactions instead.
- **Snapshots, not subscriptions.** A Resource fetcher reads `store` once at the start of each `.run()`. If the Store changes mid-flight, the in-flight fetch keeps its original snapshot.
