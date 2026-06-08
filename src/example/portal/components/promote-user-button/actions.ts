import { app } from "../../../app.ts";
import * as resource from "./resources.ts";
import { Actions, Model } from "./types.ts";

const model: Model = { busy: false };

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.Click, async (context) => {
    context.actions.produce(({ model }) => {
      model.busy = true;
    });

    try {
      await context.actions.resource(resource.promoteUser());
    } finally {
      context.actions.produce(({ model }) => {
        model.busy = false;
      });
    }
  });

  return actions;
}
