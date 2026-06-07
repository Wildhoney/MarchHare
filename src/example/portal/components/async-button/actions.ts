import { utils } from "march-hare";
import { app } from "../../../app.ts";
import { Actions, Data, Model } from "./types.ts";

const model: Model = { busy: false };

export function useActions(data: Data) {
  const context = app.useContext<Model, typeof Actions, Data>();
  const actions = context.useActions(model, () => data);

  actions.useAction(Actions.Click, async (context) => {
    context.actions.produce(({ model }) => {
      model.busy = true;
    });

    try {
      await Promise.race([
        context.data.onClick(),
        utils.sleep(1, context.task.controller.signal),
      ]);
    } finally {
      context.actions.produce(({ model }) => {
        model.busy = false;
      });
    }
  });

  return actions;
}
