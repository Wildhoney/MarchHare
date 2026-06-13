# Reusable components

A component that calls `app.useContext<...>()` is hard-wired to whichever `app` it imported. That's fine inside a feature, but it breaks down for **shared components used across multiple apps** &mdash; a monorepo with a web app, a mobile shell, and an admin tool can't pull the same `<Profile />` into all three if each one is bound to a different `App()` handle.

Every `app.X` factory has a **standalone counterpart** exposed on the `shared` namespace exported from `march-hare`. The standalone form takes the Env shape `E` as a mandatory first generic, so reusable code can declare which Env shapes it supports without importing any specific `app`:

| Bound to an App             | Standalone (`shared.X`)           |
| --------------------------- | --------------------------------- |
| `app.useContext<M, A, D>()` | `shared.useContext<E, M, A, D>()` |
| `app.useEnv()`              | `shared.useEnv<E>()`              |
| `app.Resource<T, P>(...)`   | `shared.Resource<E, T, P>(...)`   |
| `app.Scope<A>()`            | `shared.Scope<E, A>()`            |

The runtime is identical &mdash; both reach into the nearest `<app.Boundary>`. `E` is purely a type-level binding the caller supplies so the standalone form stays App-agnostic.

## A reusable feature

Here is the canonical pattern with `shared.useContext`. Note the absence of any `app` import:

```tsx
import { Action, shared } from "march-hare";

type Model = { name: string | null };
const model: Model = { name: null };

class Actions {
  static Sign = Action<string>("Sign");
}

function useProfileActions() {
  const context = shared.useContext<
    { session: Session | null },
    Model,
    typeof Actions
  >();
  const actions = context.useActions(model);

  actions.useAction(Actions.Sign, (context, name) =>
    context.actions.produce(({ model }) => void (model.name = name)),
  );

  return actions;
}

export default function Profile(): React.ReactElement {
  const [model, actions] = useProfileActions();

  return (
    <button onClick={() => actions.dispatch(Actions.Sign, "Adam")}>
      Hey {model.name}
    </button>
  );
}
```

Drop `<Profile />` inside `<web.Boundary>` and `context.env.session` reads the web app's session; drop it inside `<mobile.Boundary>` and it reads the mobile app's session. The component holds no reference to either App.

## Recommended: a monorepo Env union

When more than one `App` exists in your repo, declare a union of every Env once and parameterise every reusable component against it. Each member is the Env shape passed to that App's `App({ env })` call:

```ts
// shared/envs.ts
export type WebEnv = {
  session: Session | null;
  locale: string;
};

export type MobileEnv = {
  session: Session | null;
  platform: "ios" | "android";
};

export type AdminEnv = {
  session: Session | null;
  permissions: ReadonlyArray<string>;
};

export type Envs = WebEnv | MobileEnv | AdminEnv;
```

```ts
// web/app.ts
import { App } from "march-hare";
import type { WebEnv } from "../shared/envs";

export const web = App<WebEnv>({
  env: { session: null, locale: "en-GB" },
});

// mobile/app.ts
import { App } from "march-hare";
import type { MobileEnv } from "../shared/envs";

export const mobile = App<MobileEnv>({
  env: { session: null, platform: "ios" },
});
```

Reusable components reach for `shared.useContext<Envs, ...>` and TypeScript narrows reads to the intersection &mdash; in the example above, `env.session` works everywhere because every member declares it.

## Common keys vs. app-specific keys

`shared.useEnv<Envs>()` returns a value typed as the union, so dot reads only resolve when the key exists on **every** member. Keys that only live on a subset need an `in` / `typeof` narrowing first:

```tsx
import { shared } from "march-hare";
import type { Envs } from "../shared/envs";

function Where() {
  const env = shared.useEnv<Envs>();

  const signedIn = env.session !== null;
  const where =
    "locale" in env ? env.locale : "platform" in env ? env.platform : null;

  return <span>{signedIn ? where : "signed out"}</span>;
}
```

If a reusable component needs to behave differently per host app, declare a discriminator on every Env (`type WebEnv = { kind: "web"; ... }`) and switch on it:

```tsx
const env = shared.useEnv<Envs>();

switch (env.kind) {
  case "web":
    return <WebFooter locale={env.locale} />;
  case "mobile":
    return <MobileFooter platform={env.platform} />;
}
```

## Reusable resources

`shared.Resource<E, T, P>` is the standalone form of `app.Resource`. The fetcher's `context.env` is typed against `E`, so the resource can be shared across every App that declares a compatible Env:

```ts
// shared/resources.ts
import { shared } from "march-hare";
import type { Envs } from "./envs";

export const user = shared.Resource<Envs, User>((context) =>
  ky
    .get("/api/user", {
      headers: context.env.session
        ? { Authorization: `Bearer ${context.env.session.accessToken}` }
        : {},
      signal: context.controller.signal,
    })
    .json<User>(),
);
```

Shared resources always use an isolated in-memory cache &mdash; persistence is wired through the App via `App({ cache })`, so reach for `app.Resource` when a resource needs to survive reloads. Single-app resources should reach for `app.Resource<T>(...)` regardless &mdash; the Env is captured from `app` automatically and the call site is one generic shorter.

## Reusable multicast scopes

`shared.Scope<E, A>()` opens a multicast scope without going through an App handle. The Env carried by `scope.useContext().context.env` is typed as `E`; the multicast surface is `A`:

```tsx
// shared/mood/index.tsx
import { Action, Distribution, shared } from "march-hare";
import type { Envs } from "../envs";

export class MulticastActions {
  static Mood = Action<"happy" | "sad">("Mood", Distribution.Multicast);
}

export const scope = shared.Scope<Envs, typeof MulticastActions>();

export default function MoodArea({ children }: { children: React.ReactNode }) {
  return <scope.Boundary>{children}</scope.Boundary>;
}
```

Subscribers and triggers inside the boundary go through `scope.useContext<Model, LocalActions>()` exactly as the App-bound form &mdash; only the factory call site changes.

## App with no Env

`App()` may be called with no arguments &mdash; `env` is optional. Reach for it when the app coordinates entirely through models and broadcast actions without any ambient state:

```ts
export const web = App();
```

A reusable component dropped inside `<web.Boundary>` can still call `shared.useContext<{}, M, A, D>()` (or any wider union) &mdash; `env` resolves to an empty object and any narrowing branches simply fall through. There's no need to pass `env: {}` explicitly to `App()`.

## When the standalone form is the wrong tool

- **Single-app code.** Use `app.X` directly. The `shared.X` form only earns its keep when the call site needs to run under more than one App.
- **Per-feature scoping inside a single App.** Reach for [multicast scopes](./multicast-actions.md) instead &mdash; they're designed for that.
- **Anywhere the Env isn't relevant.** If your component doesn't read `context.env`, you don't need the standalone form at all &mdash; the App-bound `app.useContext` works the same.
