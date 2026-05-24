import { useActions } from "../../library/index.ts";
import { Model, Actions } from "./types.ts";
import { resources } from "./utils.ts";

export function useCounterActions() {
  const actions = useActions<Model, typeof Actions>({
    user: resources.user.get(),
  });

  actions.useAction(Actions.Mount, async (context) => {
    await context.actions.dispatch(Actions.User);
  });

  actions.useAction(Actions.User, async (context) => {
    const data = await context.actions.resource(resources.user);
    context.actions.produce(({ model }) => void (model.user = data));
  });

  return actions;
}
