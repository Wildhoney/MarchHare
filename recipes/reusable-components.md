# Reusable components with `useApp`

A component that calls `app.useContext<...>()` is hard-wired to whichever `app` it imported. That's fine inside a feature, but it breaks down for **shared components used across multiple apps** &mdash; a monorepo with a web app, a mobile shell, and an admin tool can't pull the same `<Profile />` into all three if each one is bound to a different `App()` handle.

`useApp<S>()` solves this. It returns a typed handle to the **nearest `<app.Boundary>`** at runtime, with `useContext` and `useEnv` parameterised by the Env shape (or union of shapes) `S` you declare at the call site. Inside the component, the binding looks identical to the per-app pattern &mdash; only the import changes.

```tsx
import { useApp, Action } from "march-hare";

type Model = { name: string | null };
const model: Model = { name: null };

class Actions {
  static Sign = Action<string>("Sign");
}

function useProfileActions() {
  const app = useApp<{ session: Session | null }>();
  const context = app.useContext<Model, typeof Actions>();
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

Drop `<Profile />` inside `<web.Boundary>` and it talks to the web app's env; drop it inside `<mobile.Boundary>` and it talks to the mobile app's env. The component holds no reference to either `App()` handle.

## Recommended: a monorepo Env union

When more than one `App` exists in your repo, declare a union once and parameterise every reusable component against it. Each member is the Env shape passed to that App's `App({ env })` call:

```ts
// shared/apps.ts
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

export type Apps = WebEnv | MobileEnv | AdminEnv;
```

```ts
// web/app.ts
import { App } from "march-hare";
import type { WebEnv } from "../shared/apps";

export const web = App<WebEnv>({
  env: { session: null, locale: "en-GB" },
});

// mobile/app.ts
import { App } from "march-hare";
import type { MobileEnv } from "../shared/apps";

export const mobile = App<MobileEnv>({
  env: { session: null, platform: "ios" },
});
```

Reusable components reach for `useApp<Apps>()` and TypeScript narrows reads to the intersection &mdash; in the example above, `env.session` works everywhere because every member declares it.

## Common keys vs. app-specific keys

`useApp<A | B | C>()`'s `useEnv()` returns a value typed as the union, so dot reads only resolve when the key exists on **every** member. Keys that only live on a subset need an `in` / `typeof` narrowing first:

```tsx
function Where() {
  const app = useApp<WebEnv | MobileEnv>();
  const env = app.useEnv();

  // Both members have `session` — direct read is fine.
  const signedIn = env.session !== null;

  // `locale` only exists on `WebEnv`; `platform` only on `MobileEnv`.
  const where =
    "locale" in env ? env.locale : "platform" in env ? env.platform : null;

  return <span>{signedIn ? where : "signed out"}</span>;
}
```

If a reusable component needs to behave differently per host app, declare a discriminator on every Env (`type WebEnv = { kind: "web"; ... }`) and switch on it:

```tsx
const env = app.useEnv();

switch (env.kind) {
  case "web":
    return <WebFooter locale={env.locale} />;
  case "mobile":
    return <MobileFooter platform={env.platform} />;
}
```

## App with no Env

`App()` may be called with no arguments &mdash; `env` is optional. Reach for it when the app coordinates entirely through models and broadcast actions without any ambient state:

```ts
export const web = App();
```

A reusable component dropped inside `<web.Boundary>` can still call `useApp<{}>()` (or any wider union) &mdash; `useEnv()` returns `{}` and any narrowing branches simply fall through. There's no need to pass `env: {}` explicitly.

## What `useApp<S>()` exposes

The returned handle is intentionally narrower than `App<S>()`:

- `useContext<M, AC, D>()` &mdash; identical to `app.useContext` from a specific App.
- `useEnv()` &mdash; identical to `app.useEnv`.

Notably absent:

- **`Boundary`** &mdash; rendered once at the App declaration site. A reusable component never opens a new App boundary.
- **`Resource`** &mdash; resources are declared at module scope so their cache and in-flight slots are stable; a hook-level `Resource(...)` would create a fresh handle each render. Import shared resources from a `resources.ts` module instead.
- **`Scope`** &mdash; multicast scopes are declared at module scope for the same reason. Open a scope at the call site via `app.Scope<typeof MulticastActions>()`.

## When `useApp` is the wrong tool

- **Single-app projects.** Import the App directly. `useApp` only earns its keep when a component genuinely needs to run under more than one App.
- **Per-feature scoping inside a single App.** Reach for [multicast scopes](./multicast-actions.md) instead &mdash; they're designed for that.
- **Resource declarations and multicast scope construction.** These are module-scope concerns; `useApp` deliberately omits them.
