# Utility Types

Similar to how React exports `React.FC` for typing functional components, Chizu exports `Handler` for typing action handlers. This allows you to define handlers in separate files with full type safety.

## Handler

The `Handler` type provides full type inference for both context and payload:

```tsx
import { useActions, Action, Handler } from "chizu";

type Model = { name: string | null };
const model: Model = { name: null };

export class Actions {
  static Name = Action<string>("Name");
}

// Define handler externally with full type inference for context and payload
const nameHandler: Handler<Model, typeof Actions, (typeof Actions)["Name"]> = (
  context,
  name,
) => {
  context.actions.produce((draft) => {
    draft.model.name = name;
  });
};

export default function useNameActions() {
  const actions = useActions<Model, typeof Actions>(model);
  actions.useAction(Actions.Name, nameHandler);
  return actions;
}
```

## Benefits

- **Type safety**: Full inference for `context` and `payload` parameters
- **Code organization**: Define handlers in separate files
- **Reusability**: Share handlers across components
- **IDE support**: Autocomplete and error checking work correctly
