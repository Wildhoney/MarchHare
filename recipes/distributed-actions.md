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
