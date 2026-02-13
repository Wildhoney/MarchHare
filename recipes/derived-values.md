# Derived Values

Use `derive` to add **new** properties to the model &ndash; either from action payloads or from the model itself.

## Action-based: subscribe to an action

```ts
import { useActions, Action, Distribution } from "chizu";

type Model = { count: number };

class BroadcastActions {
  static Counter = Action<number>("Counter", Distribution.Broadcast);
}

class Actions {
  static Broadcast = BroadcastActions;
  static Decrement = Action("Decrement");
}

export function useCounterActions() {
  const actions = useActions<Model, typeof Actions>({ count: 0 });

  actions.useAction(Actions.Decrement, (context) => {
    context.actions.produce(({ model }) => {
      model.count = model.count - 1;
    });
  });

  return actions
    .derive("label", Actions.Decrement, () => "decremented")
    .derive("doubled", Actions.Broadcast.Counter, (counter) => counter * 2);
}
```

When the action fires, the callback runs and the return value is applied to the model under the given key. Before the action fires the value is `null`. Callback parameters are auto-typed from the action's payload:

```ts
// counter is typed as number (from Action<number>)
.derive("doubled", Actions.Broadcast.Counter, (counter) => counter * 2);
//                                                  ^-- number
```

Works with unicast, broadcast, multicast, and channeled actions. For broadcast actions, cached values are replayed on mount.

## Model-based: derive from current state

Pass a selector function that receives the current model and evaluates synchronously on every render. Unlike action-based entries, model-based entries always have a value (never `null`):

```ts
return actions
  .derive("greeting", (model) => `Hello #${model.count}`)
  .derive("doubled", Actions.Broadcast.Counter, (counter) => counter * 2);
```

In the component, derived values appear directly on the model:

```tsx
const [model] = useCounterActions();
model.greeting; // string  (always has a value)
model.doubled; // number | null  (null until action fires)
model.count; // number  (original model key)
```

## Chaining

Calls to `derive` can be chained. Each call returns a new tuple with the model extended by the derived property:

```ts
return actions
  .derive("greeting", (model) => `Hello #${model.count}`)
  .derive("label", Actions.Decrement, () => "decremented")
  .derive("doubled", Actions.Broadcast.Counter, (counter) => counter * 2);
```

## Single render guarantee

When a normal `useAction` handler and a `derive` entry both fire for the same action, the component renders **once**. React 18+ batches the state updates from `produce` and the derived value update into a single render pass.

## When to use action-based vs model-based

|                   | Action-based                | Model-based                 |
| ----------------- | --------------------------- | --------------------------- |
| **Computed from** | Action payloads             | Current model fields        |
| **Evaluated**     | When the action fires       | Every render                |
| **Keys**          | New keys added to Model     | New keys added to Model     |
| **Initial value** | `null` until action fires   | Computed immediately        |
| **Use case**      | Transform a broadcast value | Computed value as a new key |
