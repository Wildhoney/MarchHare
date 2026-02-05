# Multicast actions

Multicast actions allow components within a named scope boundary to communicate with each other. Unlike broadcast actions which reach all mounted components, multicast actions are scoped to components within a `<Scope>` boundary.

## Defining multicast actions

Create a separate class for multicast actions, then reference it from your local `Actions` class:

```ts
// types.ts
import { Action, Distribution } from "chizu";

export class MulticastActions {
  static Update = Action<number>("Update", Distribution.Multicast);
}

// Component-level actions.ts
export class Actions {
  static Multicast = MulticastActions;
}
```

This pattern keeps multicast actions separate while allowing access via `Actions.Multicast.Update`.

## Creating scope boundaries

Use the `<Scope>` component to create named boundaries. All components within a scope can dispatch and receive multicast actions for that scope:

```tsx
import { Scope } from "chizu";

function App() {
  return (
    <>
      <Scope name="TeamA">
        <ScoreBoard />
        <PlayerList />
      </Scope>

      <Scope name="TeamB">
        <ScoreBoard />
        <PlayerList />
      </Scope>
    </>
  );
}
```

## Dispatching multicast actions

When dispatching a multicast action, you **must** provide the scope name as the third argument:

```tsx
// Inside any component within the scope
actions.dispatch(Actions.Multicast.Update, 42, { scope: "TeamA" });
```

The dispatch walks up the component tree to find the nearest ancestor `<Scope>` with the matching name. All components within that scope receive the event. If no matching scope is found, the dispatch is silently ignored.

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
            scope: "TeamA",
          })
        }
      >
        +1
      </button>
    </div>
  );
}
```

## Consuming multicast actions

Multicast supports `consume()` just like broadcast, but requires the scope name:

```tsx
function ScoreDisplay() {
  const [model, actions] = useScoreActions();

  return (
    <div>
      Current score:{" "}
      {actions.consume(Actions.Multicast.Update, (box) => box.value, {
        scope: "TeamA",
      })}
    </div>
  );
}
```

## Late-mounting components

Like broadcast, multicast stores the last dispatched value for each action within the scope. Components that mount later receive the cached value automatically:

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

Scopes can be nested. When dispatching, the nearest ancestor scope with the matching name is used:

```tsx
<Scope name="App">
  <Header />

  <Scope name="Sidebar">
    <Navigation />
  </Scope>

  <Scope name="Content">
    <Scope name="Editor">
      <TextEditor />
    </Scope>
  </Scope>
</Scope>
```

From `TextEditor`, dispatching to:

- `{ scope: "Editor" }` &ndash; reaches only `TextEditor`
- `{ scope: "Content" }` &ndash; reaches components in Content scope (including Editor)
- `{ scope: "App" }` &ndash; reaches all components in App scope

## Use cases

Multicast is ideal for:

- **Isolated widget groups**: Multiple instances of the same widget that shouldn't interfere with each other
- **Form sections**: Different sections of a complex form that need internal communication
- **Panels/tabs**: Distinct UI regions that operate independently
- **List items**: Each item in a list having its own isolated state management

## Comparison with broadcast

| Feature           | Broadcast                   | Multicast                              |
| ----------------- | --------------------------- | -------------------------------------- |
| Reach             | All mounted components      | Components within named scope          |
| Dispatch          | `dispatch(action, payload)` | `dispatch(action, payload, { scope })` |
| Consume           | `consume(action, renderer)` | `consume(action, renderer, { scope })` |
| Late mount values | ✓                           | ✓                                      |
| Isolation         | Global                      | Scoped                                 |
