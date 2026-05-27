import { useActions } from "march-hare";
import { Model, Actions } from "./types.ts";
import { user } from "./utils.ts";

export function useCounterActions() {
  const actions = useActions<Model, typeof Actions>({
    user: user(),
  });

  actions.useAction(Actions.Mount, async (context) => {
    await context.actions.dispatch(Actions.User);
  });

  actions.useAction(Actions.User, async (context) => {
    const data = await context.actions.resource(user());
    context.actions.produce(({ model }) => void (model.user = data));
  });

  return actions;
}
