# Feature Toggles

Toggle boolean UI state (modals, sidebars, drawers) without defining dedicated actions or handlers. The `actions.toggle()` method mutates a boolean flag on `model[Property.Features]` using the `Feature` enum. Read feature state from the model directly.

## Setup

Include a `[Property.Features]` property in your model:

```ts
import { useActions, Action, Feature, Property } from "chizu";
import type { Features } from "chizu";

type Model = {
  name: string;
  [Property.Features]: Features<["paymentDialog", "sidebar"]>;
};

const model: Model = {
  name: "",
  [Property.Features]: {
    paymentDialog: false,
    sidebar: false,
  },
};
```

## Reading

Read feature state from the model:

```tsx
{
  model[Property.Features].paymentDialog && <PaymentDialog />;
}
```

## Writing

Call `actions.toggle()` to mutate the flag and trigger a re-render:

```ts
// Invert the current value
actions.toggle("paymentDialog", Feature.Invert);

// Explicitly set to true
actions.toggle("paymentDialog", Feature.On);

// Explicitly set to false
actions.toggle("paymentDialog", Feature.Off);
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
  context.actions.toggle("paymentDialog", Feature.Off);
  context.actions.toggle("sidebar", Feature.Off);
});

actions.useAction(Actions.ToggleSidebar, (context) => {
  context.actions.toggle("sidebar", Feature.Invert);
});
```

## Full example

```tsx
import { useActions, Action, Lifecycle, Feature, Property } from "chizu";
import type { Features } from "chizu";

type Model = {
  [Property.Features]: Features<["paymentDialog", "sidebar"]>;
};

class Actions {
  static Mount = Lifecycle.Mount();
  static OpenPayment = Action("OpenPayment");
  static ClosePayment = Action("ClosePayment");
}

function useAppActions() {
  const actions = useActions<Model, typeof Actions>({
    [Property.Features]: { paymentDialog: false, sidebar: false },
  });

  actions.useAction(Actions.OpenPayment, (context) => {
    context.actions.toggle("paymentDialog", Feature.On);
  });

  actions.useAction(Actions.ClosePayment, (context) => {
    context.actions.toggle("paymentDialog", Feature.Off);
  });

  return actions;
}

export default function App() {
  const [model, actions] = useAppActions();

  return (
    <div>
      <button onClick={() => actions.toggle("sidebar", Feature.Invert)}>
        Toggle Sidebar
      </button>

      <button onClick={() => actions.dispatch(Actions.OpenPayment)}>
        Pay Now
      </button>

      {model[Property.Features].sidebar && <Sidebar />}
      {model[Property.Features].paymentDialog && <PaymentDialog />}
    </div>
  );
}
```

## Type safety

The `FeatureFlags<M>` utility type extracts the `[Property.Features]` property from your model. If your model does not have a `[Property.Features]` property, or its values are not booleans, the `toggle()` method accepts `never` as the key &ndash; making it effectively uncallable and producing a compile-time error.
