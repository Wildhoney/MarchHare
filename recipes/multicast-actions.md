# Multicast actions

Multicast actions allow components within a named scope boundary to communicate with each other. Unlike broadcast actions which reach all mounted components, multicast actions are scoped to components within a `<Scope>` boundary.

## Defining multicast actions

The scope name lives on the same class as the multicast actions, then the local `Actions` class references it:

```ts
// types.ts
import { Action, Distribution } from "chizu";

export class MulticastActions {
  static Scope = "scoreboard" as const;
  static Update = Action<number>("Update", Distribution.Multicast);
}

// Component-level actions.ts
export class Actions {
  static Multicast = MulticastActions;
}
```

Co-locating `Scope` with the multicast action declarations gives every call site a single source of truth &ndash; the library rejects bare string scopes at compile time, so typos cannot drift between declaration and usage.

## Creating scope boundaries

Use the `<Scope>` component with the carrier class to create a named boundary. All components within the scope can dispatch and receive multicast actions for that scope:

```tsx
import { Scope } from "chizu";
import { MulticastActions } from "./types";

function App() {
  return (
    <Scope of={MulticastActions}>
      <ScoreBoard />
      <PlayerList />
    </Scope>
  );
}
```

If you need two isolated scope instances (e.g. one per team), declare two carrier classes &ndash; the `static Scope` literal on each distinguishes them.

### `withScope` HOC

For components that always render inside a scope, use the `withScope` higher-order component to eliminate the manual `<Scope>` wrapper:

```tsx
import { withScope } from "chizu";
import { MulticastActions } from "./types";

export default withScope(MulticastActions, function Layout(): ReactElement {
  return (
    <div>
      <PaymentLink />
      <Outlet />
    </div>
  );
});
```

This is equivalent to wrapping the component's output in `<Scope of={MulticastActions}>`, but keeps the component body focused on rendering. Props are forwarded to the wrapped component automatically.

## Dispatching multicast actions

When dispatching a multicast action, you **must** pass the carrier class as `scope` in the third argument:

```tsx
// Inside any component within the scope
actions.dispatch(Actions.Multicast.Update, 42, { scope: Actions.Multicast });
```

The dispatch walks up the component tree to find the nearest ancestor `<Scope>` whose `.Scope` literal matches the carrier's. All components within that scope receive the event. If no matching scope is found, the dispatch is silently ignored.

```tsx
// actions.ts
function useScoreActions() {
  const actions = useActions<Model, typeof Actions>(model);

  // Handle multicast from any component in scope
  actions.useAction(Actions.Multicast.Update, (context, score) => {
    context.actions.produce(({ model }) => {
      model.score = score;
    });
  });

  return actions;
}

// component
function ScoreBoard() {
  const [model, actions] = useScoreActions();

  return (
    <div>
      <p>Score: {model.score}</p>
      <button
        onClick={() =>
          actions.dispatch(Actions.Multicast.Update, model.score + 1, {
            scope: Actions.Multicast,
          })
        }
      >
        +1
      </button>
    </div>
  );
}
```

## Subscribing to multicast values

Use `useAction` to subscribe to multicast actions and store only what you need:

```tsx
function ScoreDisplay() {
  const [model, actions] = useScoreActions();

  actions.useAction(Actions.Multicast.Update, (context, score) => {
    context.actions.produce(({ model }) => {
      model.latestScore = score;
    });
  });

  return <div>Current score: {model.latestScore ?? "—"}</div>;
}
```

## Late-mounting components

Like broadcast, multicast stores the last dispatched value for each action within the scope. Components that mount later receive the cached value automatically. If you also fetch data in `Lifecycle.Mount()`, see the [mount deduplication recipe](./mount-broadcast-deduplication.md) to avoid duplicate work.

```tsx
function LateComponent() {
  const actions = useActions<Model, typeof Actions>(model);

  // This handler is invoked with the cached value when the component mounts
  actions.useAction(Actions.Update, (context, value) => {
    console.log("Received cached value:", value);
  });

  return <div>Late Component</div>;
}
```

## Nested scopes

Scopes can be nested. Each carrier class declares its own `static Scope` literal, and dispatching uses the carrier to select the target:

```tsx
<Scope of={AppActions}>
  <Header />

  <Scope of={SidebarActions}>
    <Navigation />
  </Scope>

  <Scope of={ContentActions}>
    <Scope of={EditorActions}>
      <TextEditor />
    </Scope>
  </Scope>
</Scope>
```

From `TextEditor`, dispatching with:

- `{ scope: EditorActions }` &ndash; reaches only `TextEditor`
- `{ scope: ContentActions }` &ndash; reaches components in Content scope (including Editor)
- `{ scope: AppActions }` &ndash; reaches all components in App scope

## Use cases

Multicast is ideal for:

- **Isolated widget groups**: Multiple instances of the same widget that shouldn't interfere with each other
- **Form sections**: Different sections of a complex form that need internal communication
- **Panels/tabs**: Distinct UI regions that operate independently
- **List items**: Each item in a list having its own isolated state management

## Comparison with broadcast

| Feature           | Broadcast                    | Multicast                                                 |
| ----------------- | ---------------------------- | --------------------------------------------------------- |
| Reach             | All mounted components       | Components within named scope                             |
| Dispatch          | `dispatch(action, payload)`  | `dispatch(action, payload, { scope: Actions.Multicast })` |
| Subscribe         | `useAction(action, handler)` | Same, values scoped automatically                         |
| Late mount values | ✓                            | ✓                                                         |
| Isolation         | Global                       | Scoped                                                    |
