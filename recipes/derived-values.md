# Derived Values

Use `derive` to overlay computed values onto the model at render time. This avoids storing derived state separately and keeps the model focused on raw data while exposing computed properties to consumers.

```ts
import { useActions, Action } from "chizu";

type Model = {
  paymentLink: PaymentLink | null;
  partialCrypto: boolean;
};

const model: Model = {
  paymentLink: null,
  partialCrypto: false,
};

export function usePaymentActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Broadcast.PaymentLink, (context, paymentLink) => {
    context.actions.produce(({ model }) => {
      model.paymentLink = paymentLink;
    });
  });

  const [model] = actions;

  return actions.derive({
    partialCrypto:
      model.paymentLink?.receivable?.partialCryptoPaymentDetected === true,
  });
}
```

The returned tuple is identical in shape to the original `[model, actions]` &ndash; the only difference is that the model's `partialCrypto` value is now derived from `paymentLink` rather than its stored value.

## Type safety

Keys passed to `derive` must be existing model properties:

```ts
// Valid &ndash; `active` exists on Model
actions.derive({ active: true });

// Type error &ndash; `unknown` is not a key of Model
actions.derive({ unknown: true });
```

Value types must also match the model property types:

```ts
type Model = { count: number; name: string };

// Valid
actions.derive({ count: 42 });

// Type error &ndash; string is not assignable to number
actions.derive({ count: "forty-two" });
```

`derive` is not available when the model type is `void`.

## Chaining

Calls to `derive` can be chained. Each call merges its overrides on top of the previous result:

```ts
return actions
  .derive({ fullName: [model.firstName, model.lastName].join(" ") })
  .derive({ active: model.firstName !== null });
```

## When to use derive

- **Computed properties** &ndash; Values that can be calculated from other model fields (e.g. `fullName` from `firstName` + `lastName`).
- **Boolean flags** &ndash; Conditions derived from nested data (e.g. `partialCrypto` from a deeply nested API response field).
- **Format transformations** &ndash; Formatted strings or normalised values that the component needs but shouldn't be stored as raw state.

## How it works

`derive` creates a shallow copy of the model with the provided keys merged on top. The actions object (dispatch, inspect, consume, etc.) is shared with the original &ndash; no new subscriptions or state are created. Because the values are computed at render time, they automatically stay in sync as the underlying model updates.

---

## Action-driven derived values with `useDerived`

While `derive` computes values from the current model at render time, `useDerived` subscribes to actions and derives model properties from their **payloads**. When the action fires the callback runs, the result is applied to the model, and the component re-renders.

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

  return actions.useDerived({
    label: [Actions.Decrement, () => "decremented"],
    doubled: [Actions.Broadcast.Counter, (counter) => counter * 2],
  });
}
```

In the component, the derived values appear directly on the model without any additional typing:

```tsx
function Counter() {
  const [model, actions] = useCounterActions();

  // model.label   — string | null
  // model.doubled — number | null
  // model.count   — number (original model key)
}
```

### Type safety

Callback parameters are auto-typed from the action's payload. Return types are inferred and become the derived property type, unioned with `null` (the initial value before the action fires):

```ts
// counter is typed as number (from Action<number>)
doubled: [Actions.Broadcast.Counter, (counter) => counter * 2];
//                                                 ^-- number

// No payload needed for void actions
label: [Actions.Decrement, () => "decremented"];
```

### Single render guarantee

When a normal `useAction` handler and a `useDerived` entry both fire for the same action, the component renders **once**. React 18+ batches the state updates from `produce` and the derived value update into a single render pass.

### Works with all action types

`useDerived` accepts unicast, broadcast, multicast, and channeled actions:

```ts
return actions.useDerived({
  // Unicast
  label: [Actions.Decrement, () => "decremented"],

  // Broadcast
  doubled: [Actions.Broadcast.Counter, (counter) => counter * 2],

  // Channeled
  userName: [Actions.UserUpdated({ UserId: 5 }), (user) => user.name],
});
```

For broadcast actions, cached values are replayed on mount through the existing lifecycle infrastructure.

### When to use `useDerived` vs `derive`

|                   | `derive`                         | `useDerived`                |
| ----------------- | -------------------------------- | --------------------------- |
| **Computed from** | Current model fields             | Action payloads             |
| **Evaluated**     | Every render                     | When the action fires       |
| **Keys**          | Must exist on Model              | New keys added to Model     |
| **Initial value** | Computed immediately             | `null` until action fires   |
| **Use case**      | `fullName` from `first` + `last` | Transform a broadcast value |
