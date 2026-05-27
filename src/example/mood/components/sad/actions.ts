import { useActions } from "march-hare";
import { Model, Scope } from "../../types.ts";
import { Actions } from "./types.ts";

const model: Model = {
  selected: null,
};

export function useSadActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Select, (context, mood) => {
    context.actions.dispatch(Scope.Mood, mood);
  });

  actions.useAction(Scope.Mood, (context, mood) => {
    context.actions.produce((draft) => void (draft.model.selected = mood));
  });

  return actions;
}
