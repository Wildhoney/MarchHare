import { app } from "../../utils.ts";
import { Actions, type Model } from "./types.ts";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ cats: [] });

  actions.useAction(Actions.Broadcast.Cat.Added, (context, cat) => {
    context.actions.produce(({ model }) => void model.cats.push(cat));
  });

  return actions;
}
