# Example: Feature Sliced Design with March Hare

This example demonstrates how March Hare's primitives map cleanly onto
[Feature Sliced Design](https://feature-sliced.design/) (FSD). Each
March Hare concept corresponds to one FSD layer; the import graph
flows strictly downward (`app → features → shared`), enforced by
`eslint-plugin-boundaries` &mdash; see `eslint.config.js`.

## Layers

```
src/example/
├── app/        ← the host. One App() declaration, one Boundary, all routes.
├── features/   ← user-facing behaviours. Each feature owns its own scope.
└── shared/     ← reusable building blocks: types, resources, theme, utils.
```

### `app/`

The deployable host. There is exactly **one `App()`** per deployable
(see `app/utils.ts`), and the root `<app.Boundary>` wraps every page.
The App owns the Env (`{ apiBase }` here), and pages compose feature
components into routes.

The page itself (`app/pages/cattery/`) follows the standard March Hare
shape:

- `types.ts` &mdash; `Model`, `Actions` class, `Multicast` class when
  needed.
- `actions.ts` &mdash; `useActions()` hook that wires handlers to the
  model.
- `index.tsx` &mdash; the React component that consumes the hook.
- `styles.ts` &mdash; Emotion CSS pinned to design tokens from
  `shared/theme`.

### `features/`

Each feature is a slice of behaviour, isolated and reusable. Two are
shown here:

- **`features/add-cat/`** &mdash; the "Add a cat" button. Fetches a cat
  image from the API, dispatches a `Broadcast.Cat.Added` event when
  done. Uses **model annotations** (`context.actions.annotate(...)`)
  for the loading state &mdash; the view reads
  `actions.inspect.image.pending()` instead of a hand-rolled boolean
  flag.
- **`features/cat-card/`** &mdash; presentational component for a
  single cat. Pure props in, JSX out.

Every feature owns its own **multicast scope** via `shared.Scope<Envs,
typeof Multicast>()` declared in `utils.ts`. The component renders
inside `<scope.Boundary>` so any multicast action defined on the
feature's `Multicast` class stays confined to that feature's subtree.
The scope handle uses `shared.Scope` (not `app.Scope`) so the feature
can run under different Apps without binding to a single host. The
multicast surface is declared up-front even when no actions are
dispatched yet &mdash; the scope is the structural contract.

Feature folder layout:

```
features/<slice>/
├── types.ts    ← Model, Actions, Multicast classes; Props for presentational ones.
├── utils.ts    ← the `scope` handle: shared.Scope<Envs, typeof Multicast>()
├── actions.ts  ← useActions() hook (optional, omitted for presentational features)
└── index.tsx   ← React component; wraps children in <scope.Boundary>.
```

Feature imports may only reach into `shared/` &mdash; they must never
import from `app/` or from a sibling feature. The boundaries lint
fails CI if a feature breaks this rule.

### `shared/`

Reusable, host-agnostic building blocks:

- **`shared/types/`** &mdash; the `Env` namespace for per-App ambient
  state, the `Envs` union (used by everything outside `app/`), the
  `Payload` namespace for cross-feature data, and the `Broadcast`
  namespace housing global actions (e.g. `Broadcast.Cat.Added`).
- **`shared/resources/`** &mdash; remote data via `shared.Resource`.
  Exposed through the barrel `shared/resources/index.ts` so callers
  reach for `resource.cat.image()` rather than deep paths. Each
  resource takes `Envs` as its first generic so it stays reusable.
- **`shared/theme/`** &mdash; design tokens (colour, spacing, font,
  radius, shadow). Sizes follow a `xs / s / m / l / xl / xxl` scale.
- **`shared/components/`** &mdash; presentational atoms (e.g. the
  `Button` wrapper around antd).
- **`shared/utils/`** &mdash; pure helpers (e.g. random name
  generation).

Shared code never imports from `features/` or `app/`. It may import
from itself.

## The `Envs` type

`Env.Cat` is the concrete per-App Env shape. Anything outside `app/`
&mdash; every feature, every shared resource &mdash; must reach for
the `Envs` alias instead:

```ts
import { type Envs } from "@example/shared/types/index.ts";

export const image = shared.Resource<Envs, Cat.Response>((context) => ...);
```

`Envs` is currently `Env.Cat`, but in a real codebase it would widen to
a union of every App's Env shape (`Env.Web | Env.Mobile | ...`). Code
written against `Envs` keeps compiling when a new host is added; code
written against a specific `Env.X` does not.

Once `Envs` is a union, anything reading a key that lives on only one
arm needs to narrow first. The standard tool is a [user-defined type
guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html):
declare it once next to the union and reuse it at every site that needs
the narrowing.

```ts
// shared/types/index.ts
export type Envs = Env.Web | Env.Mobile;

export function isWeb(env: Envs): env is Env.Web {
  return "document" in env;
}

export function isMobile(env: Envs): env is Env.Mobile {
  return "deviceId" in env;
}
```

```ts
// shared/resources/cat/index.ts
import { isWeb, type Envs } from "@example/shared/types/index.ts";

export const image = shared.Resource<Envs, Cat.Response>((context) => {
  const referer = isWeb(context.env) ? context.env.document.referrer : null;
  return ky
    .get(`${context.env.apiBase}/images/search`, {
      headers: referer ? { Referer: referer } : undefined,
      signal: context.controller.signal,
    })
    .json<Cat.Response>();
});
```

Without the guard the TypeScript checker rejects `context.env.document`
because `document` is not on every arm of the union. With it, the narrowed
branch reads the Web-only field directly while the other arms compile
against whatever they actually expose &mdash; no `as`, no optional chains
papering over the difference.

## March Hare ↔ FSD mapping

| FSD concept         | March Hare primitive                                   |
| ------------------- | ------------------------------------------------------ |
| Host (app layer)    | `App<Env>()` &mdash; one per deployable                |
| Feature scope       | `shared.Scope<Envs, typeof Multicast>()`               |
| Shared resources    | `shared.Resource<Envs, T, P>(fetcher)`                 |
| Cross-cutting bus   | `Distribution.Broadcast` actions in `shared/types`     |
| Feature-private bus | `Distribution.Multicast` actions in `<feature>/types`  |
| Ambient host state  | `Env` (per-Boundary) &mdash; never `useContext()`-only |

The rule of thumb from the top-level README applies: **one `App()` per
deployable; everything inside it is a component; a component that needs
a private channel reaches for `shared.Scope`, never another `App()`**.

## Tests

- **Unit tests** (`*.test.{ts,tsx}`) live alongside the code they
  cover &mdash; e.g. `features/cat-card/index.test.tsx`. They use
  `vitest` + `@testing-library/react` and run under `happy-dom`.
- **Integration tests** (`*.integration.tsx`) drive the whole `Root`
  via the same testing-library setup &mdash; e.g.
  `app/pages/cattery/index.integration.tsx`. They mock `globalThis.fetch`
  to exercise the resource layer end-to-end.
- **End-to-end tests** live in the top-level `tests/` folder and run
  under Playwright against the real `vite dev` server.

Run everything with `make checks`.
