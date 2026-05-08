# Mode

Mode is a single mutable value shared across every component inside a `<Boundary>`. It exists to coordinate between async handlers without going through the model and without re-rendering the JSX tree.

It is opt-in: components that need it call `useMode()` and thread the returned handle through `useActions`'s `data` callback. Components that don't pay nothing.

## Setup

```ts
import { useMode, useActions } from "chizu";

enum Mode {
  Idle,
  SigningOut,
}

function useSignOutActions() {
  const mode = useMode<Mode>();
  // Spell the data shape as the third generic so `context.data.mode` keeps
  // its concrete type inside handlers.
  const actions = useActions<Model, typeof Actions, { mode: typeof mode }>(
    model,
    () => ({ mode }),
  );

  actions.useAction(Actions.SignOut, async (context) => {
    context.data.mode.update(Mode.SigningOut);
    await api.signOut();
    context.data.mode.update(Mode.Idle);
  });

  actions.useAction(Actions.Refresh, async (context) => {
    if (context.data.mode.read() === Mode.SigningOut) return;
    await fetchFeed(context.task.controller.signal);
    if (context.data.mode.read() === Mode.SigningOut) return;
    context.actions.produce(({ model }) => {
      /* ... */
    });
  });

  return actions;
}
```

> **Why the explicit third generic?** TypeScript only does partial type-argument inference when there is no default to fall back to. `useActions`'s `D extends Props = Props` default means that supplying `<Model, typeof Actions>` with `D` omitted resolves `D` to `Props` &mdash; not the inferred type from `() => ({ mode })`. Spelling `{ mode: typeof mode }` keeps everything strongly typed inside handlers.

## Why it isn't reactive

Mode does not trigger a re-render when it changes. JSX never reads it. If you need view state, put it on the model.

The reason is single-purpose: mode is for _handler coordination_, not display. Async handlers that started in parallel can read the current mode and decide whether to continue, retry, or bail out. If you wired this through the model instead, every consumer of the model would re-render on every transition &mdash; and you would still need to write the same coordination checks. Mode keeps the coordination cost out of the render path entirely.

## Why thread it through `data`

`context.data` is already the framework's "always-fresh after `await`" mechanism. Reusing it means:

- Reads inside handlers (`context.data.mode.read()`) survive `await` boundaries automatically.
- The mode value is strongly typed via the `useActions` data generic.
- `useActions` has no extra surface area; components that don't need mode never see it.

## Scope

Each `<Boundary>` provides its own mode handle. Two sibling boundaries have independent mode values; nested boundaries each get their own. Outside any boundary, `useMode()` reads from a shared fallback that no handler observes.

## When to use it

Reach for mode when:

- Several handlers need to short-circuit during a single app-level operation (sign-out, password reset, hydration replay).
- You want a single source of truth for "what flow are we in?" without threading it through props or context.
- You explicitly do **not** want the value affecting render output.

If a value should drive UI, put it on the model. If a value belongs to a single component, use a regular ref. Mode is for the narrow band between: cross-handler, non-visual, app-wide.
