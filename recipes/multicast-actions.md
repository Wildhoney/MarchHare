# Multicast actions

Multicast actions let components within a named boundary communicate with each other. Unlike broadcast actions which reach every mounted component, multicast actions are confined to a subtree wrapped in `withScope`.

Each multicast action defines its own scope &mdash; the same action you dispatch is the one you pass to `withScope`. There is no separate "scope name"; the action's identity is the scope key.

## Defining multicast actions

Group multicast actions on a class. Naming the class `Scope` reads naturally at the call site (`Scope.Update`, `Scope.Mood`):

```ts
// types.ts
import { Action, Distribution } from "march-hare";

export class Scope {
  static Update = Action<number>("Update", Distribution.Multicast);
}
```

`Distribution.Multicast` takes no argument &mdash; each action provides its own scope identity.

## Creating scope boundaries

Wrap the subtree in `withScope`, passing the multicast action that opens the scope:

```tsx
import { withScope } from "march-hare";
import { Scope } from "./types";

function ScoreArea() {
  return (
    <>
      <ScoreBoard />
      <PlayerList />
    </>
  );
}

export default withScope(Scope.Update, ScoreArea);
```

If you need two isolated scope instances of the same shape (e.g. one per team), declare two multicast actions &mdash; each is its own scope.

## Dispatching multicast actions

Dispatch the multicast action like any other; the scope is read from the action itself:

```tsx
function useScoreActions() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Scope.Update, (context, score) => {
    context.actions.produce(({ model }) => void (model.score = score));
  });

  return actions;
}

function ScoreBoard() {
  const [model, actions] = useScoreActions();

  return (
    <div>
      <p>Score: {model.score}</p>
      <button onClick={() => actions.dispatch(Scope.Update, model.score + 1)}>
        +1
      </button>
    </div>
  );
}
```

The dispatch walks up the component tree to find the nearest ancestor `withScope` boundary that opened this multicast action. Every component inside that boundary receives the event. If no matching boundary exists, the dispatch is silently ignored.

## Subscribing to multicast values

Use `useAction` to subscribe and store only what you need locally:

```tsx
function ScoreDisplay() {
  const [model, actions] = useScoreActions();

  actions.useAction(Scope.Update, (context, score) => {
    context.actions.produce(({ model }) => void (model.latestScore = score));
  });

  return <div>Current score: {model.latestScore ?? "—"}</div>;
}
```

## Late-mounting components

Like broadcast, multicast caches the last dispatched value per scope. Components that mount later receive the cached value automatically. If you also fetch data in `Lifecycle.Mount()`, see the [mount deduplication recipe](./mount-broadcast-deduplication.md) to avoid duplicate work.

```tsx
function LateComponent() {
  const context = useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Scope.Update, (context, value) => {
    console.log("Received cached value:", value);
  });

  return <div>Late Component</div>;
}
```

## Nested scopes

Scopes can be nested. Each multicast action opens its own scope independently, so wrapping a subtree in multiple `withScope` HOCs composes naturally:

```tsx
class Scope {
  static App = Action("App", Distribution.Multicast);
  static Sidebar = Action("Sidebar", Distribution.Multicast);
  static Editor = Action("Editor", Distribution.Multicast);
}

const ScopedSidebar = withScope(Scope.Sidebar, Sidebar);
const ScopedEditor = withScope(Scope.Editor, Editor);

function AppShell() {
  return (
    <>
      <Header />
      <ScopedSidebar />
      <ScopedEditor />
    </>
  );
}

export default withScope(Scope.App, AppShell);
```

From inside `Editor`:

- `dispatch(Scope.Editor, payload)` &mdash; reaches only the Editor subtree
- `dispatch(Scope.App, payload)` &mdash; reaches the whole App subtree (including the Editor)

## Use cases

Multicast is ideal for:

- **Isolated widget groups**: Multiple instances of the same widget that shouldn't interfere with each other
- **Form sections**: Different sections of a complex form that need internal communication
- **Panels/tabs**: Distinct UI regions that operate independently
- **List items**: Each item in a list having its own isolated state management

## Comparison with broadcast

| Feature           | Broadcast                    | Multicast                                            |
| ----------------- | ---------------------------- | ---------------------------------------------------- |
| Reach             | All mounted components       | Components inside the matching `withScope`           |
| Declaration       | `Distribution.Broadcast`     | `Distribution.Multicast` (action is its own scope)   |
| Dispatch          | `dispatch(action, payload)`  | `dispatch(action, payload)` &mdash; no extra options |
| Subscribe         | `useAction(action, handler)` | Same, values scoped automatically                    |
| Late mount values | ✓                            | ✓                                                    |
| Isolation         | Global                       | Per multicast action's `withScope` boundary          |
