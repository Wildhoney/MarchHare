# Feature Toggles

Toggle boolean UI state (modals, sidebars, drawers) without defining dedicated actions or handlers. The `actions.feature()` method mutates a boolean flag on `model.features` using the `Feature` enum. Read feature state from the model directly.

## Setup

Include a `features` property in your model:

```ts
import { useActions, Action, Feature } from "chizu";

type Model = {
  name: string;
  features: { paymentDialog: boolean; sidebar: boolean };
};

const model: Model = {
  name: "",
  features: {
    paymentDialog: false,
    sidebar: false,
  },
};
```

## Reading

Read feature state from the model:

```tsx
{
  model.features.paymentDialog && <PaymentDialog />;
}
```

## Writing

Call `actions.feature()` to mutate the flag and trigger a re-render:

```ts
// Toggle the current value
actions.feature("paymentDialog", Feature.Toggle);

// Explicitly set to true
actions.feature("paymentDialog", Feature.On);

// Explicitly set to false
actions.feature("paymentDialog", Feature.Off);
```

`Feature.On` and `Feature.Off` are idempotent &ndash; calling `Feature.On` when the feature is already `true` does not change the value.

## Usage in handlers

The same API is available on `context.actions` inside action handlers:

```ts
class Actions {
  static CloseAll = Action("CloseAll");
  static ToggleSidebar = Action("ToggleSidebar");
}

actions.useAction(Actions.CloseAll, (context) => {
  context.actions.feature("paymentDialog", Feature.Off);
  context.actions.feature("sidebar", Feature.Off);
});

actions.useAction(Actions.ToggleSidebar, (context) => {
  context.actions.feature("sidebar", Feature.Toggle);
});
```

## Full example

```tsx
import { useActions, Action, Lifecycle, Feature } from "chizu";

type Model = {
  features: { paymentDialog: boolean; sidebar: boolean };
};

class Actions {
  static Mount = Lifecycle.Mount();
  static OpenPayment = Action("OpenPayment");
  static ClosePayment = Action("ClosePayment");
}

function useAppActions() {
  const actions = useActions<Model, typeof Actions>({
    features: { paymentDialog: false, sidebar: false },
  });

  actions.useAction(Actions.OpenPayment, (context) => {
    context.actions.feature("paymentDialog", Feature.On);
  });

  actions.useAction(Actions.ClosePayment, (context) => {
    context.actions.feature("paymentDialog", Feature.Off);
  });

  return actions;
}

export default function App() {
  const [model, actions] = useAppActions();

  return (
    <div>
      <button onClick={() => actions.feature("sidebar", Feature.Toggle)}>
        Toggle Sidebar
      </button>

      <button onClick={() => actions.dispatch(Actions.OpenPayment)}>
        Pay Now
      </button>

      {model.features.sidebar && <Sidebar />}
      {model.features.paymentDialog && <PaymentDialog />}
    </div>
  );
}
```

## Type safety

The `FeatureFlags<M>` utility type extracts the `features` property from your model. If your model does not have a `features` property, or its values are not booleans, the `feature()` method accepts `never` as the key &ndash; making it effectively uncallable and producing a compile-time error.
