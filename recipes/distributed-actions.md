# Distributed actions

Distributed actions allow different components to communicate with each other. Unlike regular actions which are scoped to a single component, distributed actions are broadcast to all mounted components that have defined a handler for them.

To create a distributed action, use `Distribution.Broadcast` as the first parameter. A good pattern is to define distributed actions in a shared class that other action classes can extend:

```ts
import { Action, Distribution } from "chizu";

export class DistributedActions {
  static SignedOut = Action("SignedOut", Distribution.Broadcast);
}

export class Actions extends DistributedActions {
  static Increment = Action("Increment");
}
```

Distributed actions return a `DistributedPayload<T>` type, which is distinct from the `Payload<T>` returned by unicast actions. This enables compile-time enforcement &ndash; only distributed actions can be passed to `actions.consume()`.

Any component that defines a handler for `DistributedActions.SignedOut` will receive the action when it's dispatched from any other component.

## Filtering distributed actions

When multiple components subscribe to the same distributed action, all handlers execute on dispatch. Use `With.Filter` to conditionally execute handlers based on the payload or component-specific data:

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

When a component mounts with a `useAction()` handler for a distributed action, the handler is automatically invoked with the most recent cached value (if one exists). This mirrors the behaviour of `consume()` and enables late-mounting components to receive historical state.

```tsx
// Component A uses consume() which stores values in the cache
function ComponentA() {
  const [model, actions] = useActions<Model, typeof Actions>(model);

  return <div>{actions.consume(Actions.Counter, (box) => box.value)}</div>;
}

// Component B dispatches the action
function ComponentB() {
  const [model, actions] = useActions<Model, typeof Actions>(model);

  return (
    <button onClick={() => actions.dispatch(Actions.Counter, 42)}>
      Update Counter
    </button>
  );
}

// Component C mounts later and receives the cached value
function ComponentC() {
  const actions = useActions<Model, typeof Actions>(model);

  // This handler is invoked with 42 when the component mounts
  // (assuming ComponentB dispatched before ComponentC mounted)
  actions.useAction(Actions.Counter, (context, value) => {
    console.log("Received cached value:", value);
  });

  return <div>Late Component</div>;
}
```

> **Note:** The cache is populated by `consume()` calls (which create internal `Partition` components). For cached values to be available, at least one component must use `consume()` for that action. If no component has ever consumed the action, late-mounting handlers won't receive a cached value.

## Direct broadcast access

For direct access to the broadcast emitter, use `useBroadcast()`:

```ts
import { useBroadcast } from "chizu";

const broadcast = useBroadcast();

// Emit a distributed action
broadcast.emit(DistributedActions.SignedOut, payload);

// Listen for a distributed action
broadcast.on(DistributedActions.SignedOut, (payload) => {
  // Handle the action...
});
```
