import { app } from "../../../app.ts";
import { Model, MulticastActions } from "../../types.ts";
import { Actions } from "./types.ts";

const model: Model = {
  selected: null,
};

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();

  const actions = context.useActions(model);

  actions.useAction(Actions.Select, (context, mood) => {
    context.actions.dispatch(MulticastActions.Mood, mood);
  });

  actions.useAction(MulticastActions.Mood, (context, mood) => {
    context.actions.produce((draft) => void (draft.model.selected = mood));
  });

  return actions;
}
