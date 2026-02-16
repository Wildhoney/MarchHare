# Broadcast actions

Broadcast actions allow different components to communicate with each other. Unlike regular actions which are scoped to a single component, broadcast actions are sent to all mounted components that have defined a handler for them.

To create a broadcast action, use `Distribution.Broadcast` as the second parameter. A good pattern is to define broadcast actions in a shared class and reference them via a static property:

```ts
import { Action, Distribution } from "chizu";

export class BroadcastActions {
  static SignedOut = Action("SignedOut", Distribution.Broadcast);
}

export class Actions {
  static Broadcast = BroadcastActions;
  static Increment = Action("Increment");
}
```

Broadcast actions return a `BroadcastPayload<T>` type, which is distinct from the `Payload<T>` returned by unicast actions. This enables compile-time enforcement &ndash; only broadcast actions support reactive subscription via `useAction`.

Any component that defines a handler for `Actions.Broadcast.SignedOut` will receive the action when it's dispatched from any other component.

## Filtering broadcast actions

When multiple components subscribe to the same broadcast action, all handlers execute on dispatch. Use `With.Filter` to conditionally execute handlers based on the payload or component-specific data:

```ts
import { With } from "chizu";

actions.useAction(
  Actions.Person,
  With.Filter(
    (context, person) => person.id === context.data.personId,
    async (context, person) => {
      const details = await fetch(`/person/${person.id}`);
      context.actions.produce((draft) => {
        draft.model.person = details;
      });
    },
  ),
);
```

The predicate receives the context and the fully-typed payload. When it returns `false`, the handler never executes &ndash; preventing unnecessary API calls or state updates. This is useful when many components listen for the same action type but should only respond to specific instances.

## Cached values on mount

When a component mounts with a `useAction()` handler for a broadcast action, the handler is automatically invoked with the most recent cached value (if one exists). The broadcast emitter caches values automatically when they are dispatched, enabling late-mounting components to receive historical state.

```tsx
// Component A dispatches the action
function ComponentA() {
  const [, actions] = useActions<Model, typeof Actions>(model);

  return (
    <button onClick={() => actions.dispatch(Actions.Counter, 42)}>
      Update Counter
    </button>
  );
}

// Component B mounts later and receives the cached value
function ComponentB() {
  const actions = useActions<Model, typeof Actions>(model);

  // This handler is invoked with 42 when the component mounts
  // (assuming ComponentA dispatched before ComponentB mounted)
  actions.useAction(Actions.Counter, (context, value) => {
    console.log("Received cached value:", value);
  });

  return <div>Late Component</div>;
}
```

> **Note:** The broadcast cache stores the most recent payload for each action automatically. Late-mounting components receive this cached value during the mounting phase.

## Consuming broadcast values

For reading broadcast values imperatively in handlers (`context.actions.consume`, `context.actions.peek`) or rendering them declaratively in JSX (`actions.consume`), see the [consuming broadcast values recipe](./consuming-actions.md).

## Direct broadcast access

For direct access to the broadcast emitter, use `useBroadcast()`:

```ts
import { useBroadcast } from "chizu";

const broadcast = useBroadcast();

// Emit a broadcast action
broadcast.emit(Actions.Broadcast.SignedOut, payload);

// Listen for a broadcast action
broadcast.on(Actions.Broadcast.SignedOut, (payload) => {
  // Handle the action...
});
```
