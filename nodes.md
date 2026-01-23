Considering a way to make it easier to get DOM nodes, instead of user having to add lots of useRef calls, we could provide a way to do it better:

```tsx
type Elements = {
    container: HTMLDivElement;
    input: HTMLInputElement;
}
```

Then when creating useActions:

```ts
useActions<Model, typeof Actions, Elements>(model, data);
```

Then later we can use a special "elements" item in the model with the supplied `Elements` type then return in actions a way for the developer to attach those elements:

```tsx
<section ref={elememnt => actions.capture('input', element)}>
```

Then `model.state.elements`.
