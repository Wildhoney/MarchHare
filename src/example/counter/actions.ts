import { app } from "../app.ts";
import { Model, Actions } from "./types.ts";
import * as resource from "./utils.ts";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ user: resource.user() });

  actions.useAction(Actions.Mount, async (context) => {
    await context.actions.dispatch(Actions.User);
  });

  actions.useAction(Actions.User, async (context) => {
    const user = await context.actions.resource(resource.user());
    context.actions.produce(({ model }) => void (model.user = user));
  });

  return actions;
}
