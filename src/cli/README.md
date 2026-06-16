# `@march-hare/cli` — the `mh` scaffolder

A [Hygen](https://github.com/jondot/hygen)-style code generator that
scaffolds [March Hare](../../README.md) projects and the building
blocks inside them. Templates mirror the layout of
[`src/example/`](../example/) and the FSD layering rules enforced by
[`eslint-plugin-boundaries`](https://github.com/javierbrea/eslint-plugin-boundaries):
imports flow strictly downward (`app → features → shared`).

```
   __  ___                __       __  __
  /  |/  /___ ___________/ /_     / / / /___ _________
 / /|_/ / __ `/ ___/ ___/ __ \   / /_/ / __ `/ ___/ _ \
/ /  / / /_/ / /  / /__/ / / /  / __  / /_/ / /  /  __/
/_/  /_/\__,_/_/   \___/_/ /_/  /_/ /_/\__,_/_/   \___/
```

## Contents

- [Quick start](#quick-start)
- [Interactive menu vs. direct commands](#interactive-menu-vs-direct-commands)
- [`mh init`](#mh-init)
- [`mh app …`](#mh-app-)
- [`mh feature …`](#mh-feature-)
- [`mh shared …`](#mh-shared-)
- [Generated project layout](#generated-project-layout)
- [How the templates work](#how-the-templates-work)
- [Adding your own generators](#adding-your-own-generators)
- [Development](#development)

## Quick start

The CLI ships with `march-hare` itself — installing the library
exposes the `mh` binary:

```bash
npm install -g march-hare    # global: `mh` is on your PATH
mh init my-project

# — or —

npm install march-hare       # local: invoke through npx / package scripts
npx mh init my-project
```

Working inside this repo? Run the CLI straight from source — root
`yarn install` covers all its deps:

```bash
node dist/cli/bin/mh.js            # interactive menu
node dist/cli/bin/mh.js init demo  # scaffold a project into ./demo
```

When run without arguments the CLI prints the Figlet banner and an
interactive menu of every top-level command.

## Interactive menu vs. direct commands

Every command in the CLI is a node in a tree. Pass none, one, or all
of the path segments — the CLI fills in the gaps with prompts.

| You type             | What happens                                       |
| -------------------- | -------------------------------------------------- |
| `mh`                 | Menu of top-level commands                         |
| `mh feature`         | Menu of sub-commands under `feature`               |
| `mh feature new`     | Prompts you for the feature name then scaffolds it |
| `mh feature new foo` | Scaffolds `features/foo/` with no prompts          |
| `mh --help`          | Prints the whole command tree                      |

Any leaf command accepts `--name=value` and `--flag` style overrides
so you can drive it from scripts without prompts.

## `mh init`

Bootstraps a brand-new March Hare project mirroring `src/example/`.

```bash
mh init my-project
```

Prompts you for:

- **Project name** — kebab-case slug used for the package name and the
  folder it lives in.
- **Description** — populates `package.json` and the root README.
- **API base URL** — seeded into the App's Env at
  `src/app/utils.ts`.

What you get:

```
my-project/
├── eslint.config.js          ← FSD boundaries enforced via plugin-boundaries
├── package.json              ← React 19 + March Hare 0.13 + Vite + Vitest + Playwright
├── playwright.config.ts
├── tsconfig.json             ← @app/* @features/* @shared/* path aliases
├── vite.config.ts
├── vitest.config.ts
├── index.html
├── README.md
├── tests/
│   └── home.e2e.ts
└── src/
    ├── index.tsx
    ├── test-setup.ts
    ├── vite-env.d.ts
    ├── app/
    │   ├── index.tsx         ← <app.Boundary> root
    │   ├── utils.ts          ← App<Env.X>({ env: { apiBase } })
    │   └── pages/home/       ← home page (button + greeting)
    │       ├── index.tsx
    │       ├── types.ts
    │       ├── actions.ts
    │       ├── styles.ts
    │       └── index.integration.tsx
    ├── features/greet/       ← stateful "say hello" feature
    │   ├── index.tsx
    │   ├── types.ts
    │   ├── actions.ts
    │   ├── utils.ts          ← shared.Scope<Envs, typeof Multicast>()
    │   └── index.test.tsx
    └── shared/
        ├── components/button/ ← antd wrapper + tests
        ├── theme/             ← colour / spacing / font / radius / shadow tokens
        ├── types/             ← Env namespace + Envs alias + Payload + Broadcast
        └── resources/         ← empty barrel; add resources with `mh shared resource`
```

A working "Say hello" button is wired end-to-end so you can verify the
project boots before deleting it.

```bash
cd my-project
yarn install   # or npm install
yarn dev
```

## `mh app …`

Manage the host layer.

| Command                | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `mh app new <name>`    | New page under `src/app/pages/<name>/` (index/types/actions/styles) |
| `mh app integration`   | Picks a page, drops in an `index.integration.tsx`                   |
| `mh app action <page>` | Picks (or accepts) a page, injects a new `Actions.X` + handler      |

Examples:

```bash
mh app new dashboard --tagline="Live metrics"
mh app integration               # prompts you to pick a page
mh app action dashboard Refresh  # injects Actions.Refresh + a handler
```

The `action` command injects into both `types.ts` (adds
`static Refresh = Action("Refresh")`) and `actions.ts` (adds an empty
`actions.useAction(Actions.Refresh, …)` block before `return actions`).
Re-running the same command is a no-op thanks to `skip_if`.

## `mh feature …`

Manage feature slices.

| Command                          | What it does                                                             |
| -------------------------------- | ------------------------------------------------------------------------ |
| `mh feature new <name>`          | New feature; asks whether it owns state (`--stateful` / `--no-stateful`) |
| `mh feature unit <name>`         | Adds a `index.test.tsx` next to an existing feature                      |
| `mh feature action <feat> <act>` | Injects an `Actions.<Act>` member + a handler stub into the feature      |
| `mh feature multicast <feat>`    | Injects a multicast action into the feature's `Multicast` class          |

Stateful features get four files: `index.tsx`, `types.ts`, `actions.ts`,
`utils.ts`. Presentational features get three (no `actions.ts`). Both
shapes include a `Multicast` class and a `scope` handle
(`shared.Scope<Envs, typeof Multicast>()`) — the structural contract
for the feature's private bus.

## `mh shared …`

Manage reusable building blocks.

| Command                           | What it does                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| `mh shared component <name>`      | New presentational atom under `src/shared/components/`       |
| `mh shared resource <name>`       | New `shared.Resource<Envs, T>` under `src/shared/resources/` |
| `mh shared util <name>`           | New util module under `src/shared/utils/`                    |
| `mh shared type payload <name>`   | Injects a `Payload.<Name>` type into `shared/types`          |
| `mh shared type broadcast <name>` | Injects a global broadcast action into `shared/types`        |
| `mh shared unit <kind> <name>`    | Adds a unit test for a shared module                         |

```bash
mh shared component card
mh shared resource user
mh shared util parse-date
mh shared type payload Notification
mh shared type broadcast Toast
mh shared unit components card
```

After creating a resource, re-export it from
`src/shared/resources/index.ts` so it stays reachable as
`resource.<name>.fetch()`:

```ts
export * as user from "./user/index.ts";
```

## Generated project layout

The CLI's `init` template seeds the App's `Env` shape based on the
project name. If you run `mh init billing`, the generated
`shared/types/index.ts` declares `Env.Billing` and `Envs = Env.Billing`:

```ts
export namespace Env {
  export type Billing = {
    apiBase: string;
  };
}

export type Envs = Env.Billing;
```

When you later add a second deployable (e.g. a marketing site) you
widen `Envs` to a union and add a [user-defined type
guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html)
to narrow at the call site — see the example's
[README](../example/README.md) for the full pattern.

## How the templates work

Templates live under [`templates/<generator>/<action>/`](./templates).
Each `.ejs.t` file has a tiny [Hygen-style](https://www.hygen.io/docs/templates)
frontmatter block plus an EJS body.

```ejs
---
to: src/features/<%= name %>/index.tsx
---
import * as React from "react";
// …
```

Supported frontmatter keys:

| Key       | What it does                                                                               |
| --------- | ------------------------------------------------------------------------------------------ |
| `to`      | Output path. Rendered through EJS so it can reference template vars.                       |
| `inject`  | Set to `true` to inject the body into an existing file instead of overwriting it.          |
| `before`  | Regex (multiline). With `inject`, inserts the body **above** the first match.              |
| `after`   | Regex (multiline). With `inject`, inserts the body **below** the first match.              |
| `skip_if` | Regex (multiline). With `inject`, skip the file if it already matches (idempotent reruns). |
| `if`      | EJS expression. Skip the template entirely unless it evaluates truthy.                     |
| `force`   | EJS expression. When truthy, overwrite an existing file (default: skip).                   |

Helpers available inside templates:

| Helper      | Example             | Result      |
| ----------- | ------------------- | ----------- |
| `kebab(s)`  | `kebab("AddCat")`   | `"add-cat"` |
| `pascal(s)` | `pascal("add-cat")` | `"AddCat"`  |
| `camel(s)`  | `camel("add-cat")`  | `"addCat"`  |
| `title(s)`  | `title("add-cat")`  | `"Add Cat"` |

Standard variables passed to every render:

- `name` — the kebab-case name accepted from positional / prompt.
- `pascalName` — same value run through `pascal()`.

Commands pass additional vars (e.g. `feature`, `page`, `rawName`,
`env`, `apiBase`) — see the individual command files under
[`lib/commands/`](./lib/commands).

## Adding your own generators

1. Create `templates/<generator>/<action>/foo.ejs.t` with a `to:`
   frontmatter and an EJS body.
2. Wire a leaf into [`lib/commands/index.ts`](./lib/commands/index.ts) that calls
   `scaffold("<generator>", "<action>", vars, { cwd })`.
3. Optionally add prompts via the helpers in
   [`lib/prompt/index.ts`](./lib/prompt/index.ts).

Templates can render any number of files — every `.ejs.t` under the
action directory is processed, with each `to:` resolved
independently. Use nested directories under the action to keep big
generators (like `init`) tidy.

## Development

The CLI's runtime deps (`@inquirer/prompts`, `ejs`, `figlet`, `kleur`)
live in the root [`package.json`](../../package.json). A single
`yarn install` at the repo root is all you need:

```bash
yarn install            # from the repo root
node dist/cli/bin/mh.js # run the CLI from source
```

There are no build steps — the CLI is plain ESM JavaScript. Templates
are read directly from disk at runtime.

To verify a change end-to-end:

```bash
cd /tmp && rm -rf check && mkdir check && cd check
node "$OLDPWD/dist/cli/bin/mh.js" init demo \
  --description="dev check" --apiBase="https://api.example.test"
cd demo
node /Users/adamtimberlake/Webroot/MarchHare/dist/cli/bin/mh.js feature new counter --stateful
node /Users/adamtimberlake/Webroot/MarchHare/dist/cli/bin/mh.js feature action counter Reset
```

Then `yarn install && yarn checks` inside the generated project should
pass cleanly.
