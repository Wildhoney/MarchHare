# Feature Toggles

Toggle boolean UI state (modals, sidebars, drawers) without defining dedicated actions or handlers. The `actions.features` methods mutate a boolean flag on `model.meta.features`. Read feature state from the model directly.

## Setup

Include a `meta` property with `features` in your model using the `Meta` utility type:

```ts
import { useActions, Action } from "chizu";
import type { Meta } from "chizu";

type F = {
  paymentDialog: boolean;
  sidebar: boolean;
};

type Model = {
  name: string;
  meta: Meta.Features<F>;
};

const model: Model = {
  name: "",
  meta: {
    features: {
      paymentDialog: false,
      sidebar: false,
    },
  },
};
```

## Reading

Read feature state from the model:

```tsx
{
  model.meta.features.paymentDialog && <PaymentDialog />;
}
```

## Writing

Call `actions.features.on()`, `actions.features.off()`, or `actions.features.invert()` to mutate the flag and trigger a re-render:

```ts
// Invert the current value
actions.features.invert("paymentDialog");

// Explicitly set to true
actions.features.on("paymentDialog");

// Explicitly set to false
actions.features.off("paymentDialog");
```

`on()` and `off()` are idempotent &ndash; calling `on()` when the feature is already `true` does not change the value.

## Usage in handlers

The same API is available on `context.actions` inside action handlers:

```ts
class Actions {
  static CloseAll = Action("CloseAll");
  static ToggleSidebar = Action("ToggleSidebar");
}

actions.useAction(Actions.CloseAll, (context) => {
  context.actions.features.off("paymentDialog");
  context.actions.features.off("sidebar");
});

actions.useAction(Actions.ToggleSidebar, (context) => {
  context.actions.features.invert("sidebar");
});
```

## Full example

```tsx
import { useActions, Action, Lifecycle } from "chizu";
import type { Meta } from "chizu";

type F = {
  paymentDialog: boolean;
  sidebar: boolean;
};

type Model = {
  meta: Meta.Features<F>;
};

class Actions {
  static Mount = Lifecycle.Mount();
  static OpenPayment = Action("OpenPayment");
  static ClosePayment = Action("ClosePayment");
}

function useAppActions() {
  const actions = useActions<Model, typeof Actions>({
    meta: { features: { paymentDialog: false, sidebar: false } },
  });

  actions.useAction(Actions.OpenPayment, (context) => {
    context.actions.features.on("paymentDialog");
  });

  actions.useAction(Actions.ClosePayment, (context) => {
    context.actions.features.off("paymentDialog");
  });

  return actions;
}

export default function App() {
  const [model, actions] = useAppActions();

  return (
    <div>
      <button onClick={() => actions.features.invert("sidebar")}>
        Toggle Sidebar
      </button>

      <button onClick={() => actions.dispatch(Actions.OpenPayment)}>
        Pay Now
      </button>

      {model.meta.features.sidebar && <Sidebar />}
      {model.meta.features.paymentDialog && <PaymentDialog />}
    </div>
  );
}
```

## Type safety

The `FeatureFlags<M>` utility type extracts the `meta.features` property from your model. If your model does not have a `meta.features` property, or its values are not booleans, the `features` methods accept `never` as the key &ndash; making them effectively uncallable and producing a compile-time error.
