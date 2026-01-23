# Utility Types

Chizu exports `Handler` for typing action handlers when you need to define them in separate files with full type safety.

## Handler

Use `Handler` to type extracted handlers:

```tsx
import { useActions, Action, Handler } from "chizu";

type Model = { name: string | null; age: number | null };
const model: Model = { name: null, age: null };

export class Actions {
  static SetName = Action<string>("SetName");
  static SetAge = Action<number>("SetAge");
}

// Type handlers using Handler<Model, Actions, ActionKey>
export const handleSetName: Handler<Model, typeof Actions, "SetName"> = (
  context,
  name,
) => {
  context.actions.produce((draft) => {
    draft.model.name = name;
  });
};

export const handleSetAge: Handler<Model, typeof Actions, "SetAge"> = (
  context,
  age,
) => {
  context.actions.produce((draft) => {
    draft.model.age = age;
  });
};

// Use in component
export default function useUserActions() {
  const actions = useActions<Model, typeof Actions>(model);
  actions.useAction(Actions.SetName, handleSetName);
  actions.useAction(Actions.SetAge, handleSetAge);
  return actions;
}
```

## Type Parameters

| Parameter | Description                                    |
| --------- | ---------------------------------------------- |
| `M`       | The model type                                 |
| `AC`      | The actions class type (`typeof Actions`)      |
| `K`       | The action key (`keyof AC`)                    |
| `D`       | Optional data/props type (defaults to `Props`) |

## Inline Handlers (Recommended)

For most cases, inline handlers with full type inference are simpler:

```tsx
export default function useUserActions() {
  const actions = useActions<Model, typeof Actions>(model);

  // Types are fully inferred - no explicit typing needed
  actions.useAction(Actions.SetName, (context, name) => {
    context.actions.produce((draft) => {
      draft.model.name = name;
    });
  });

  return actions;
}
```

## When to Extract Handlers

Extract handlers when you need:

- **Unit testing**: Test handlers in isolation
- **Reusability**: Share handlers across components
- **Code organisation**: Separate handler logic from component code
