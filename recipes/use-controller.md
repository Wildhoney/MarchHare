# `app.useContext` &mdash; dispatch before the model

Some external libraries take a dispatch callback at construction time &mdash; form libraries (`useForm({ onSubmit })`), animation engines, third-party SDKs, IntersectionObserver wrappers. When the value those libraries return _also_ needs to flow back into `context.useActions` via the data callback, the ordering creates a chicken-and-egg:

- `useForm({ onSubmit })` needs `actions.dispatch` to wire `onSubmit`.
- `context.useActions(initial, () => ({ form, ... }))` needs `form` to expose it as `data.form`.
- Each depends on the other existing first.

`app.useContext<Model, typeof Actions, Data>()` resolves this by returning a stable, typed handle up-front. The handle exposes `context.actions.dispatch` (callable immediately) and `context.useActions(initialModel, getData?)` (registers the model and wires the controller's dispatch to the underlying emitter when it runs in the same render pass).

## The minimal shape

```tsx
import { app } from "./app";
import { useForm } from "formikate";
import { Model, Actions } from "./types.ts";

type Data = {
  form: Formikate<BillingSchema>;
};

export function useActions() {
  const context = app.useContext<Model, typeof Actions, Data>();

  const form = useForm<BillingSchema>({
    fields: billingFields,
    onSubmit: () => void context.actions.dispatch(Actions.Submit),
  });

  const actions = context.useActions({ user: user() }, () => ({
    form,
  }));

  actions.useAction(Actions.Submit, async (context) => {
    if (!(await context.data.form.validate())) return;
    // ...
  });

  return actions;
}
```

Reading order maps directly to declaration order:

1. `app.useContext<Model, typeof Actions, Data>()` &mdash; returns a stable, typed handle with `dispatch` and `useActions`.
2. `useForm({ onSubmit })` &mdash; closes over `context.actions.dispatch`. The handle's reference never changes, so the closure is safe across renders.
3. `context.useActions(initial, () => ({ form }))` &mdash; registers the model and wires the controller to the underlying emitter. `form` is now available as `data.form` to handlers and to JSX via the third tuple element.

## Real-world example: card payment flow

Below is a payment form integrating `formikate` (synchronous form library), a Worldpay SDK, and a Checkout.com SDK. The form's `onSubmit` needs `context.actions.dispatch`, and the resulting form instance is consumed by both handlers (validation, value extraction) and JSX (rendering `<BillingForm form={data.form} />`). Multiple imperative SDKs converge on a single action surface.

```ts
import { useState } from "react";
import { app } from "./app";
import { useForm } from "formikate";
import { useNavigate } from "react-router-dom";
import { Destination, useClient, useParams } from "@hive/data.shared/providers";
import { useSessionDestination } from "../../../../../hooks/session-destination/index.ts";
import { useCheckoutCard } from "../../../../../components/checkout-flow/sdk.ts";
import { hasBillingRequirement } from "../../../../../components/checkout-flow/billing.ts";
import {
  billingFields,
  type BillingSchema,
} from "../../../../../components/checkout-flow/validation.ts";
import { Actions, type Model, type Data } from "./types.ts";

const model: Model = {
  paymentLink: null,
  provider: null,
  sessionId: null,
  paymentFailed: false,
  isCheckout: false,
  isCheckoutLoading: false,
  billingRequired: false,
};

export function useActions() {
  const navigate = useNavigate();
  const params = useParams<Destination.CardPayment>();
  const destination = useSessionDestination();
  const client = useClient();

  const publicKey =
    <string | undefined>import.meta.env.VITE_PUBLIC_CHECKOUT_PUBLIC_KEY ?? "";

  const [, setCheckoutSession] = useState<string | null>(null);
  const checkout = useCheckoutCard(null, publicKey);

  const context = app.useContext<Model, typeof Actions, Data>();

  const form = useForm<BillingSchema>({
    fields: billingFields,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: () => void context.actions.dispatch(Actions.Submit),
  });

  const actions = context.useActions(model, () => ({
    client,
    paymentLinkReference: params.paymentLinkReference,
    navigate,
    destination,
    setCheckoutSession,
    form,
    checkout,
  }));

  actions.useAction(Actions.Update, (context) => {
    const cardMetadata = context.data.checkout.state.cardMetadata;
    const cardCollectionSettings =
      context.model.paymentLink?.cardCollectionSettings;
    const billingRequired = hasBillingRequirement(
      cardMetadata?.issuerCountry,
      cardMetadata?.scheme,
      cardCollectionSettings?.visaAftSupportedCountries ?? [],
    );
    const isCheckoutLoading =
      context.model.isCheckout &&
      !context.data.checkout.state.isReady &&
      !context.data.checkout.state.error;
    if (
      billingRequired !== context.model.billingRequired ||
      isCheckoutLoading !== context.model.isCheckoutLoading
    ) {
      context.actions.produce((draft) => {
        draft.model.billingRequired = billingRequired;
        draft.model.isCheckoutLoading = isCheckoutLoading;
      });
    }
  });

  actions.useAction(Actions.Submit, async (context) => {
    const { checkout, form } = context.data;
    checkout.actions.setSubmitting(true);

    try {
      const tokenResult = await checkout.actions.tokenize();
      if (!tokenResult) {
        checkout.actions.setSubmitting(false);
        return;
      }

      const errors = await form.validateForm();
      if (Object.keys(errors).length > 0) {
        const touched = Object.fromEntries(
          Object.keys(billingFields).map((k) => [k, true]),
        );
        void form.setTouched(touched);
        checkout.actions.setSubmitting(false);
        return;
      }

      // submit, navigate, etc.
    } catch (error) {
      checkout.actions.setSubmitting(false);
      checkout.actions.setError(
        error instanceof Error ? error.message : "Payment failed.",
      );
    }
  });

  return actions;
}
```

The notable points:

- **No `dispatchRef` and no manual wiring.** `context.actions.dispatch` is stable from the first line, so `useForm`'s `onSubmit` captures it directly.
- **The form flows back through `data`.** JSX in the consuming component renders `<BillingForm form={data.form} />` and handlers read `context.data.form` after `await` boundaries &mdash; both via the third tuple element / handler context.
- **The handle is the only library import.** No bare `useActions` at the top of the file.

### Before, with the chicken-and-egg workaround

Before `useContext`, the same code needed a forward `useRef`:

```ts
import { useRef } from "react";

const dispatchRef = useRef<((action: typeof Actions.Submit) => unknown) | null>(
  null,
);

const form = useForm<BillingSchema>({
  onSubmit: () => void dispatchRef.current?.(Actions.Submit),
});

const actions = useActions<Model, typeof Actions, Data>(model, () => ({
  /* ..., */ form,
}));

dispatchRef.current = (action) => actions.dispatch(action);
```

Three problems the ref pattern caused:

1. **A typed escape hatch every form-with-submit needed.** Every `dispatchRef` declared the action surface manually &mdash; here `((action: typeof Actions.Submit) => unknown)`. Drift between the ref's type and the real dispatch surface was easy.
2. **Trailing assignment.** `dispatchRef.current = ...` had to come after `useActions` &mdash; easy to forget when scanning the file.
3. **Reads at the wrong time.** `dispatchRef.current?.(...)` returns silently if the ref is somehow read before assignment. The handle from `useContext` throws &mdash; a fail-loud guard.

`useContext` collapses all three: typed once at the top, no trailing assignment, fail-loud guard if you misuse it during render.

## When _not_ to reach for it

`useContext` is only worth it when the chicken-and-egg actually bites. Two cheaper alternatives exist:

**Closure capture &mdash; when `form` is used in one handler only.** Handlers are re-registered each render via `useLayoutEffect`, so a plain closure stays fresh between invocations.

```ts
const context = useContext<Model, typeof Actions>();
const actions = context.useActions(initial);

const form = useForm({
  onSubmit: () => void actions.dispatch(Actions.Submit),
});

actions.useAction(Actions.Submit, async (context) => {
  if (!(await form.validate())) return;
  // ...
});
```

This works if you don't need `form` in `data` &mdash; i.e. JSX doesn't read it via the third tuple element and only one handler touches it.

**Drop `form` from `data` &mdash; when JSX doesn't read it.** If the form isn't consumed via the third tuple element, the cycle dissolves: `context.useActions` runs first, `useForm` runs second, no value flows back.

Reach for the up-front `context.actions.dispatch` capture when JSX or multiple handlers all need to read the form-like value across `await` boundaries via `context.data` &mdash; the case the `data` controller was built for.

## What the handle is

The result of `app.useContext<AC>()` is a plain object with two members:

- `context.actions.dispatch(action, payload?)` &mdash; same signature as `actions.dispatch` returned by `context.useActions`. Typed against `AC`, with channeled-action overloads.
- `context.useActions(initialModel?, getData?)` &mdash; returns the `[model, actions, data]` tuple with `useAction`, `dispatch`, `inspect`, and `stream` attached.

The handle is stable across renders, so capturing `context.actions.dispatch` once in `useForm` (or any other external constructor) is safe. Invoking `context.actions.dispatch(...)` before `context.useActions(...)` has run in the same render pass throws &mdash; in practice this only happens if you call it synchronously during render. Event-handler invocations always happen after the render commits and are safe.

## Naming convention

When a component's `actions.ts` uses this pattern, the wrapper hook can simply be called `useActions`:

```ts
// actions.ts
import { app } from "./app";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({
    /* ... */
  });
  // ...
  return actions;
}
```

```tsx
// index.tsx
import { useActions } from "./actions.ts";

export default function Component() {
  const [model, actions] = useActions();
  // ...
}
```

No name conflict with the library: `app.useContext` is the only entrypoint used, and the method on the controller handle is accessed as `context.useActions(...)`, not as a bare identifier.
