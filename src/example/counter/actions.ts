import { useActions, useResource } from "../../library/index.ts";
import { Model, Actions } from "./types.ts";
import { resources } from "./utils.ts";

export function useCounterActions() {
  const get = {
    user: useResource(resources.user),
  };

  const actions = useActions<Model, typeof Actions>({
    user: get.user.else(null),
  });

  actions.useAction(Actions.Mount, async (context) => {
    await context.actions.dispatch(Actions.User);
  });

  actions.useAction(Actions.User, async (context) => {
    const user = await get.user();
    context.actions.produce(({ model }) => void (model.user = user));
  });

  return actions;
}
