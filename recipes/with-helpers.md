# `With` helpers

`context.with.{update,invert,always}` (and the top-level `With.{Update,Invert,Always}` form) are typed handler factories for one-line mutations &mdash; binding a payload to a field, flipping a boolean, or pinning a leaf to a fixed value. They compile to the same `context.actions.produce(...)` recipe you'd write by hand, but the call site stays a single expression and the path is type-checked against the model.

All three accept lodash-style dotted paths (`"a.b.c"`) and array indices (`"items.0.name"`). Keys autocomplete from the model declared on `app.useContext<Model, …>()`. Prefer the `context.with.*` form &mdash; the methods narrow against the typed context. Reach for the top-level `With.*` import only at call sites without a typed context in scope.

## `with.update(key)` &mdash; bind the payload to a field

Use when an action exists purely to assign its payload to a model leaf:

```tsx
import { Action } from "march-hare";
import { app } from "./app";

type Model = {
  name: string | null;
  address: { city: string };
};

const model: Model = {
  name: null,
  address: { city: "" },
};

export class Actions {
  static SetName = Action<string>("SetName");
  static SetCity = Action<string>("SetCity");
}

function useShellActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.SetName, context.with.update("name"));
  actions.useAction(Actions.SetCity, context.with.update("address.city"));

  return actions;
}
```

Type-checked: the payload type must match the leaf type at the path. `context.with.update("name")` accepts `string`; `context.with.update("address.city")` accepts `string`; mismatches fail at compile time.

Equivalent hand-written form:

```ts
actions.useAction(Actions.SetName, (context, name) => {
  context.actions.produce(({ model }) => void (model.name = name));
});
```

## `with.invert(key)` &mdash; flip a boolean

Toggling boolean UI state &mdash; modals, sidebars, drawers &mdash; is the canonical case. Bind a unicast action to the field and call `dispatch` without a payload:

```tsx
import { Action } from "march-hare";
import { app } from "./app";

type Model = {
  paymentDialog: boolean;
  sidebar: boolean;
};

const model: Model = {
  paymentDialog: false,
  sidebar: false,
};

export class Actions {
  static TogglePaymentDialog = Action("TogglePaymentDialog");
  static ToggleSidebar = Action("ToggleSidebar");
}

function useShellActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(
    Actions.TogglePaymentDialog,
    context.with.invert("paymentDialog"),
  );
  actions.useAction(Actions.ToggleSidebar, context.with.invert("sidebar"));

  return actions;
}

export default function Shell(): React.ReactElement {
  const [model, actions] = useShellActions();

  return (
    <>
      <button onClick={() => actions.dispatch(Actions.TogglePaymentDialog)}>
        Pay
      </button>
      {model.paymentDialog && <PaymentDialog />}
    </>
  );
}
```

`with.invert` only compiles when the leaf at the path is a `boolean`. Any dispatched payload is ignored &mdash; the helper unconditionally flips.

## `with.always(key, value)` &mdash; pin a leaf to a fixed value

Use for Open/Close, Show/Hide, Start/Stop pairs where each action pins the model to a known value, regardless of payload:

```tsx
import { Action } from "march-hare";
import { app } from "./app";

type Model = {
  panel: { open: boolean };
  phase: "idle" | "ready" | "running";
};

const model: Model = {
  panel: { open: false },
  phase: "idle",
};

export class Actions {
  static Open = Action("Open");
  static Close = Action("Close");
  static Ready = Action("Ready");
}

function useShellActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Open, context.with.always("panel.open", true));
  actions.useAction(Actions.Close, context.with.always("panel.open", false));
  actions.useAction(Actions.Ready, context.with.always("phase", "ready"));

  return actions;
}
```

Type-checked: `value` must be assignable to the leaf type at `key`. `phase` accepts only `"idle" | "ready" | "running"`; any other literal fails at compile time.

## Top-level `With.*` form

The top-level import is identical at runtime but loses the model-aware autocomplete &mdash; the path is typed against whatever inference the call site can gather. Reach for it only when you don't have a typed `context` in scope, for example inside a generic helper or when wiring handlers from a module that doesn't import the App:

```ts
import { With, Action } from "march-hare";

actions.useAction(Actions.SetName, With.Update("name"));
actions.useAction(Actions.Toggle, With.Invert("open"));
actions.useAction(Actions.Ready, With.Always("phase", "ready"));
```

## When to skip the helpers

Reach for a hand-written handler when:

- The mutation isn't a single assignment &mdash; multiple fields, derived values, or conditional logic.
- The handler awaits anything &mdash; resources, sleeps, dispatches.
- The handler needs annotations, error branching, or `context.data` reads.

The helpers are deliberately narrow. Anything beyond "set this leaf" should be the full `context.actions.produce(...)` form.
