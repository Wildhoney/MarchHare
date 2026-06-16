---
to: src/features/<%= name %>/actions.ts
---
import { Actions, type Model } from "./types.ts";
import { scope } from "./utils.ts";

export function useActions() {
  const context = scope.useContext<Model, typeof Actions>();
  const actions = context.useActions({ count: 0 });

  actions.useAction(Actions.Tick, (context) => {
    context.actions.produce(({ model }) => void (model.count += 1));
  });

  return actions;
}
