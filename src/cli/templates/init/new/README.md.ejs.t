---
to: README.md
---
# <%= title(name) %>

<%= description %>

Built with [March Hare](https://github.com/Wildhoney/MarchHare) and the
[`@march-hare/cli`](https://github.com/Wildhoney/MarchHare/tree/main/src/cli)
scaffolder.

## Layout

```
src/
├── app/        ← the host. One App() declaration, one Boundary, all routes.
├── features/   ← user-facing behaviours. Each feature owns its own scope.
└── shared/     ← reusable building blocks: types, resources, theme, utils.
```

Layer boundaries are enforced by `eslint-plugin-boundaries` — imports
flow strictly downward (`app → features → shared`).

## Scripts

| Command              | What it does                              |
| -------------------- | ----------------------------------------- |
| `yarn dev`           | Start the Vite dev server                 |
| `yarn test`          | Run unit + integration tests with Vitest  |
| `yarn test:e2e`      | Run Playwright end-to-end tests           |
| `yarn typecheck`     | TypeScript with no emit                   |
| `yarn lint`          | ESLint                                    |
| `yarn checks`        | Format, lint, typecheck, and test         |

## Scaffolding more

With the CLI installed globally (`npm i -g @march-hare/cli`) or linked
locally, drop new pages, features, and shared modules in:

```bash
mh                    # interactive menu
mh feature new        # add a feature
mh app new            # add a page
mh shared component   # add a shared component
```

See the [CLI README](https://github.com/Wildhoney/MarchHare/tree/main/src/cli)
for the full list.
