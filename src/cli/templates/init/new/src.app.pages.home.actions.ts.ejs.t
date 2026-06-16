---
to: src/app/pages/home/actions.ts
---
import { app } from "../../utils.ts";
import { Actions, type Model } from "./types.ts";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ greeting: null });

  actions.useAction(Actions.Broadcast.Greeted, (context, message) => {
    context.actions.produce(({ model }) => void (model.greeting = message));
  });

  return actions;
}
