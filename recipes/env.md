# Env

The `Env` is a per-`<app.Boundary>` typed record of cross-cutting, mutable state. It holds whatever doesn't belong in the model &mdash; session tokens, locale, feature flags, current operational mode &mdash; anything ambient that handlers read on every call and that `Resource` fetchers need without explicit threading.

Reads are plain dot notation (`env.session`); writes go through `context.actions.produce(({ env }) => { env.x = ... })`, the same Immer-style recipe used for the model. There are no `.get`/`.set`/`.read` methods.

Every Env key flows into three places automatically:

- **`app.useEnv()`** &mdash; the hook-level read-only handle (Proxy; dot reads are always fresh).
- **`context.env`** &mdash; the same handle inside `useActions` handlers.
- **`env` field** on every `app.Resource` fetcher's args object &mdash; the same live Proxy as `context.env`, so dot reads stay fresh across `await` boundaries inside the fetcher.

Env is **not** reactive. Mutating it does not trigger a re-render. Drive view state through the model; reach for the Env when you need cross-handler coordination or auth-style ambient values.

## Declaring the shape

The Env's shape is owned by an `App` instance. `App({ env })` infers the shape from the initial-value object, and every hook the App returns is typed against it:

```ts
// app.ts
import { App } from "march-hare";
import type { Session } from "./auth/types";

export const app = App({
  env: {
    session: null as Session | null,
    locale: "en-GB",
    operating: "idle" as "idle" | "signing-out",
  },
});
```

Different `<app.Boundary>` instances in the same tree can be backed by different `App` calls with completely independent shapes &mdash; the `Env` type is no longer process-global.

## Wiring the initial value

Render the App's Boundary at the root:

```tsx
import { app } from "./app";

<app.Boundary>
  <Root />
</app.Boundary>;
```

The initial value lives on the App; the Boundary delivers it to the subtree. Writes through `context.actions.produce(({ env }) => ...)` replace the slot with a fresh object via Immer.

## Reading via dot notation

The Env is auto-threaded into every handler's `context` and every Resource fetcher's args &mdash; nothing to wire, read `context.env.x`:

```ts
import { app } from "./app";

export function useActions() {
  const context = app.useContext<void, typeof Actions>();
  const actions = context.useActions();

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.env.operating === "signing-out") return;
    if (context.env.session === null) return;
    // ...
  });

  return actions;
}
```

`context.env.session`, `context.env.locale` &mdash; whatever you declared on `App({ env })`. The handle is a `Proxy` that delegates to the live ref, so dot reads always reflect the latest write, even after `await` boundaries.

### When to reach for `app.useEnv()`

`app.useEnv()` returns the same read-only Proxy at the hook level. Most features never need it &mdash; `context.env` covers handler reads, and the [view side](#reactivity-caveats) reacts via `Lifecycle.Env`. Reach for `app.useEnv()` only when you need the Proxy outside any handler, for example to hand a `() => env.session` closure to an external library at module bridge time (see [session-tokens.md](./session-tokens.md#refresh-on-401) for the canonical use case).

## Writing via `context.actions.produce`

Writes happen inside an action handler through the same `produce` mechanism the model uses:

```ts
import * as resource from "../resources";

actions.useAction(Actions.SignIn, async (context, credentials) => {
  const signIn = await context.actions.resource(resource.signIn(credentials));
  context.actions.produce(({ env }) => {
    env.session = signIn;
    env.operating = "idle";
  });
});

actions.useAction(Actions.SignOut, async (context) => {
  context.actions.produce(({ env }) => {
    env.operating = "signing-out";
  });
  await context.actions.resource(resource.signOut());
  context.actions.produce(({ env }) => {
    env.session = null;
    env.operating = "idle";
  });
});
```

The `env` draft is an Immer draft &mdash; deep mutations work naturally:

```ts
context.actions.produce(({ env }) => {
  env.session = { accessToken: "abc", refreshToken: "def" };
  // Or mutate in place:
  env.session.accessToken = "xyz";
});
```

Both model and env live in the same produce callback, so you can mutate them atomically when needed:

```ts
context.actions.produce(({ model, env }) => {
  if (model.user) model.user.name = "Adam";
  env.operating = "idle";
});
```

Model mutations re-render; Env mutations don't.

### Writes outside handlers are blocked

`app.useEnv()` returns a read-only Proxy. Direct assignment throws:

```ts
const env = app.useEnv();
env.session = result;
// TypeError: Env is read-only outside `context.actions.produce`.
```

This is a deliberate guard. If you need to set the Env during component setup or outside an action flow, dispatch an action that does it &mdash; that keeps every Env mutation traceable through the action log.

## Resource fetchers receive the Env

Every fetcher's args object includes an `env` field &mdash; a live read-only handle to the per-`<app.Boundary>` Env, typed against the App's shape:

```ts
export const user = app.Resource<User, { id: number }>({
  fetch({ env, controller, params }) {
    return ky
      .get(`users/${params.id}`, {
        headers: env.session
          ? { Authorization: `Bearer ${env.session.accessToken}` }
          : {},
        signal: controller.signal,
      })
      .json<User>();
  },
});
```

`env` is the same `Proxy` the App exposes to handlers via `context.env`, so dot reads inside the fetcher always reflect the latest value &mdash; including mid-flight, after an `await`. The handle delegates to the live per-`<app.Boundary>` ref at every access. If you need a stable snapshot inside a fetcher (e.g. to compare before/after a retry), copy the value into a local at the top: `const token = env.session?.accessToken`.

## Reactivity caveats

The Env is **not** a React state primitive. Direct `app.useEnv()` reads do not re-render components when the Env changes &mdash; the hook returns a Proxy that delegates to the live ref. Use the Env for the _handler_ side, where dot reads inside handlers and fetchers are always fresh.

For the view side, subscribe to `Lifecycle.Env` &mdash; a singleton broadcast that fires every time `produce` mutates the Env. It delivers the full latest snapshot to every subscriber in the surrounding `<app.Boundary>`, and seeds with the initial Env so late mounters see the current value on mount:

```ts
actions.useAction(Lifecycle.Env, (context, env) => {
  // runs every time produce({ env }) changes the slot
});
```

Render directly against the Env in JSX without lifting it into the model:

```tsx
{
  actions.stream(Lifecycle.Env, (env) => <span>{env.locale}</span>);
}
```

`Lifecycle.Env` does **not** fire when a `produce` call mutates only the model &mdash; the slot reference is checked after each `produce` and the broadcast is emitted only when it changes. See [lifecycle-actions.md](./lifecycle-actions.md#lifecycleenv-global-broadcast) for the full contract.

## Multiple Envs

Because the shape is owned by `App({ env })`, an application can host several Boundaries with completely independent shapes:

```ts
// admin.ts
export const admin = App({ env: { permissions: [] as Permission[] } });

// public.ts
export const pub = App({ env: { locale: "en-GB" } });
```

Each `<admin.Boundary>` / `<pub.Boundary>` subtree gets its own typed handles; there is no shared module-augmented `Env` type.

## Limitations

- **Not for view state.** If you mutate the Env and want the UI to update, you've reached for the wrong primitive &mdash; use a model field with a broadcast for cross-component reactions instead.
