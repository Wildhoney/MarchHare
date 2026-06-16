---
to: src/features/greet/actions.ts
---
import { Actions, type Model } from "./types.ts";
import { scope } from "./utils.ts";

export function useActions() {
  const context = scope.useContext<Model, typeof Actions>();
  const actions = context.useActions({ count: 0 });

  actions.useAction(Actions.Click, async (context) => {
    context.actions.produce(({ model }) => void (model.count += 1));
    await context.actions.dispatch(
      Actions.Broadcast.Greeted,
      `Hello from <%= title(name) %> #${context.model.count + 1}`,
    );
  });

  return actions;
}
