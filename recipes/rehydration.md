# Rehydrating component state

Chizu can automatically persist a component's model state when it unmounts and restore it when it remounts. This is useful for components that are conditionally rendered (tab switching, route changes, accordion panels) where you want to preserve the user's state without lifting it to a parent.

## Store definition

Define a `Store` class using `Id` to create typed store entries. Each entry represents a snapshot slot in the rehydrator:

```ts
import { Id } from "chizu";

type CounterModel = { count: number };
type SettingsModel = { theme: string };

class Store {
  // Channeled — independent snapshot per UserId
  static Counter = Id<CounterModel, { UserId: number }>();

  // Unchanneled — single shared snapshot
  static Settings = Id<SettingsModel>();
}
```

The first type parameter binds the store entry to a model type. TypeScript will reject any `Rehydrate(model, storeId)` call where the model and store entry disagree on the model shape, preventing accidental cross-component snapshot usage.

## Basic usage

Wrap your initial model with `Rehydrate(model, channel)` and pass it to `useActions`. The channel acts as a unique key for the snapshot:

```ts
import { useActions, Rehydrate, Id, Action } from "chizu";

type Model = { count: number };

const model: Model = { count: 0 };

class Actions {
  static Increment = Action("Increment");
}

class Store {
  static Counter = Id<Model, { UserId: number }>();
}

export function useCounterActions(userId: number) {
  const actions = useActions<Model, typeof Actions>(
    Rehydrate(model, Store.Counter({ UserId: userId })),
  );

  actions.useAction(Actions.Increment, (context) => {
    context.actions.produce(({ model }) => {
      model.count += 1;
    });
  });

  return actions;
}
```

For unchanneled store entries, call the entry with no arguments:

```ts
class Store {
  static Settings = Id<Model>();
}

const actions = useActions<Model, typeof Actions>(
  Rehydrate(model, Store.Settings()),
);
```

## How it works

1. **Mount** &ndash; `useActions` checks the rehydrator for an existing snapshot matching the channel key. If found, the model is initialised from the snapshot instead of the initial model. If not found, the initial model is used as normal.
2. **Live** &ndash; the model mutates as usual via `context.actions.produce()`. The rehydration key is inert during the component's lifetime.
3. **Unmount** &ndash; before cleanup runs, the current model is snapshotted into the rehydrator under the channel key.
4. **Remount** &ndash; step 1 kicks in and the state is restored.

## Invalidating snapshots

Use `context.actions.invalidate` to remove a snapshot from the rehydrator. The next mount of the target component will start fresh instead of restoring stale data:

```ts
actions.useAction(Actions.Increment, (context) => {
  context.actions.produce(({ model }) => {
    // Invalidate another component's snapshot
    context.actions.invalidate(Store.Counter({ UserId: 5 }));
    model.count += 1;
  });
});

// Invalidate an unchanneled snapshot
context.actions.invalidate(Store.Settings());
```

This is useful when one component modifies shared state and needs to ensure another component does not restore an outdated snapshot.

## Channel keys

The channel follows the same pattern as channeled actions &ndash; an object of non-nullable primitives. Different channel values produce independent snapshots:

```ts
// Each user gets their own persisted state
Rehydrate(model, Store.Counter({ UserId: 5 }));
Rehydrate(model, Store.Counter({ UserId: 10 }));
```

## Boundary scoping

The rehydrator is scoped to the nearest `<Boundary>`. Each `<Boundary>` provides its own isolated rehydrator, so snapshots in one boundary won't leak into another:

```tsx
import { Boundary } from "chizu";

<Boundary>
  {/* These components share a rehydrator */}
  <TabPanel />
  <Sidebar />
</Boundary>

<Boundary>
  {/* Separate rehydrator — fully isolated */}
  <Widget />
</Boundary>
```

## What gets persisted

Only the raw model state is persisted &ndash; not Immertation annotations. Any in-flight `Op.Update` annotations are meaningless after unmount since the async operations that created them have been aborted. If your model contains transient state (loading flags, error messages) that shouldn't survive a restore, reset those fields in a `Lifecycle.Mount` handler:

```ts
actions.useAction(Lifecycle.Mount, (context) => {
  context.actions.produce(({ model }) => {
    model.error = null;
    model.loading = false;
  });
});
```

## Strict mode

Rehydration is compatible with React's StrictMode. The snapshot is only written on real unmounts, not during StrictMode's development-only teardown/remount cycles. This is handled automatically via the same `queueMicrotask` + generation counter pattern used for lifecycle events.

## Without rehydration

If you don't pass `Rehydrate`, `useActions` works exactly as before &ndash; the model is initialised fresh on every mount. Rehydration is entirely opt-in.
