import { utils } from "march-hare";
import { faker } from "@faker-js/faker";
import { app } from "../../../app.ts";
import { Status } from "../../types.ts";
import { Actions, Model } from "./types.ts";

const model: Model = { user: null };

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions(model);

  actions.useAction(Actions.SignIn, async (context) => {
    context.actions.produce((draft) => {
      draft.model.user = context.actions.annotate(null);
    });

    await utils.sleep(1_000, context.task.controller.signal);

    context.actions.produce((draft) => {
      draft.model.user = faker.person.firstName();
      draft.env.status = Status.Authenticated;
    });
  });

  actions.useAction(Actions.SignOut, async (context) => {
    context.actions.produce((draft) => {
      draft.model.user = null;
      draft.env.status = Status.Guest;
    });
  });

  return actions;
}
