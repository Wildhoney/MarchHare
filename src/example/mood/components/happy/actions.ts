import { useActions } from "../../../../library/index.ts";
import { Model } from "../../types.ts";
import { Actions } from "./types.ts";

const model: Model = {
  selected: null,
};

export function useHappyActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Select, (context, mood) => {
    context.actions.dispatch(Actions.Multicast.Mood, mood, { scope: "mood" });
  });

  actions.useAction(Actions.Multicast.Mood, (context, mood) => {
    context.actions.produce((draft) => {
      draft.model.selected = mood;
    });
  });

  return actions;
}
