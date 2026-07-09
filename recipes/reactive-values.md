# Reactive values

`Lifecycle.Reactive` bridges external reactive values &mdash; a React Query result, a prop, a store selector &mdash; into the action pipeline. Declare the action as a static, then bind the value at the `useAction` site by calling the static with it. The handler fires whenever the bound value changes between renders, receiving the latest value as its payload:

```tsx
import { Lifecycle } from "march-hare";
import { useQuery } from "@tanstack/react-query";
import { app } from "./app";

type Model = { profile: User | null };

export class Actions {
  static User = Lifecycle.Reactive<User | undefined>("User");
}

export function useProfileActions() {
  const { data: user } = useQuery({ queryKey: ["user"], queryFn: fetchUser });

  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ profile: null });

  actions.useAction(Actions.User(user), async (context, user) => {
    context.actions.produce(({ model }) => void (model.profile = user ?? null));
  });

  return actions;
}
```

The optional name (`"User"`) surfaces in taps and fault reports; omit it and the action reports as `"Reactive"`.

## Why not `useEffect`?

A `useEffect(() => { ... }, [user])` can watch the same value, but the callback runs outside March Hare entirely. Binding through `Lifecycle.Reactive` routes the change through the standard dispatch pipeline, so the handler gets everything any other handler gets:

- A task with an `AbortController` &mdash; `context.task.controller.signal` aborts on unmount and composes with `utils.sleep` (see [Debouncing](#debouncing) below).
- `context.actions.produce`, annotations, and `context.data` freshness after `await`.
- Tap observability &mdash; every firing appears in `<Boundary tap={...}>` with its start/end and mutations.
- Error routing &mdash; a throwing handler reaches `Lifecycle.Error()` locally and the global `Lifecycle.Fault` broadcast.
- Generator support &mdash; `async function*` handlers iterate to completion in the background.

## Firing semantics

Changes are detected with `Object.is` against the **last-dispatched** value, which starts as `undefined`:

| Transition                                   | Fires?                            |
| -------------------------------------------- | --------------------------------- |
| Mount with a defined value                   | Yes &mdash; once, with that value |
| Mount with `undefined`                       | No &mdash; stays silent           |
| `undefined` &rarr; defined                   | Yes                               |
| Defined &rarr; defined (different reference) | Yes                               |
| Defined &rarr; defined (same reference)      | No                                |
| Defined &rarr; `undefined`                   | Yes &mdash; with `undefined`      |

Two points deserve emphasis:

- **Defined-at-mount fires.** This deliberately diverges from `Lifecycle.Update()`, which never fires on mount. A hydrated cache (React Query with persisted data, SSR dehydration) delivers the value on the very first render and never changes it &mdash; a skip-mount rule would mean the handler never fires at all.
- **Reference equality is the contract.** React Query's structural sharing keeps `data` referentially stable until its content changes, so `Object.is` is exactly right there. For values recomputed every render (fresh object literals, unmemoised `.map(...)` results), memoise before binding &mdash; an always-new reference fires on every render.

The declared payload type is honest about `undefined`: `Lifecycle.Reactive<User | undefined>` admits the query's loading state, and the handler must handle `undefined` on the way back out (query key changes, cache eviction). Declare `Lifecycle.Reactive<User>` instead and TypeScript rejects binding a possibly-`undefined` value.

## Subscription variants

The called and uncalled forms mirror channeled actions &mdash; the binding targets one call site, the uncalled static hears everything:

```ts
// Binds the value — fires only for this site's changes.
actions.useAction(Actions.User(user), handler);

// Uncalled — hears every reactive dispatch of Actions.User in this component.
actions.useAction(Actions.User, audit);

// Manual re-fire — reaches every handler, bound and uncalled alike.
actions.dispatch(Actions.User, user);
```

Two bindings of the same static within one component stay isolated &mdash; each site's changes reach only its own handler. Bindings are subscribe-only: `dispatch(Actions.User(user))` does not compile; dispatch the uncalled static with a payload instead.

## Bridging to the whole app

`Lifecycle.Reactive` symbols are per-component unicast, like every other lifecycle. To let an entire `<Boundary>` consume an external value, observe it once near the root and re-dispatch a broadcast:

```ts
export class Actions {
  static User = Lifecycle.Reactive<User | undefined>("User");
}

export class Broadcast {
  static User = Action<User | undefined>("User", Distribution.Broadcast);
}

actions.useAction(Actions.User(user), (context, user) =>
  context.actions.dispatch(Broadcast.User, user),
);
```

Everything else in the boundary reads `Broadcast.User` via `useAction`, `stream()`, `peek()`, or `final()` &mdash; including the cached replay for late-mounting components.

## Debouncing

A rapidly-changing bound value (a search query prop typed character by character) fires a dispatch per change. Each dispatch is an **independent** task: consistent with every other dispatch in March Hare, a newer firing does **not** abort the in-flight handler from the previous one &mdash; only unmount aborts a task automatically. To debounce, abort the sibling tasks of the same action yourself before sleeping, then let the abort signal cancel the superseded sleep:

```ts
export class Actions {
  static Query = Lifecycle.Reactive<string>("Query");
}

actions.useAction(Actions.Query(props.query), async (context, query) => {
  for (const task of context.tasks) {
    if (task !== context.task && task.action === context.task.action) {
      task.controller.abort();
    }
  }
  await utils.sleep(300, context.task.controller.signal);
  const results = await fetch(`/search?q=${query}`, {
    signal: context.task.controller.signal,
  });
});
```

Each keystroke aborts the previous firing's sleep, so only the last change in a burst reaches the fetch. Guard ordering-sensitive work by reading `context.data` after the `await` rather than trusting the payload snapshot.

## Avoid model-derived values

If the bound value is derived from the model, the loop never settles: the handler produces a model change, the component re-renders, the derivation yields a new reference, and the binding fires again. `Object.is` breaks the cycle only when the derivation is referentially stable. Bind **external** values &mdash; queries, props, store selectors &mdash; and keep model reactions inside ordinary handlers.

## Choosing the right tool

| Need                                            | Reach for                                          |
| ----------------------------------------------- | -------------------------------------------------- |
| Run a handler when one external value changes   | `Lifecycle.Reactive` binding                       |
| Know which of several data keys changed         | `Lifecycle.Update()` with the changed-keys payload |
| Read the latest external value after an `await` | `context.data`                                     |

The three compose: a component can bind a query result reactively, subscribe to `Update` for coarse-grained data changes, and read `context.data` inside any long-running handler.
