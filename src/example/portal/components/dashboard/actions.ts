import { message } from "antd";
import { isHTTPError } from "ky";
import { Lifecycle, Reason, utils } from "march-hare";
import { faker } from "@faker-js/faker";
import { app } from "../../../app.ts";
import { Status } from "../../types.ts";
import * as resource from "./resources.ts";
import { Actions, Data, Model } from "./types.ts";

const model: Model = { user: null, deleteUser: false };

export function useActions() {
  const [messageApi, contextHolder] = message.useMessage();
  const context = app.useContext<Model, typeof Actions, Data>();
  const actions = context.useActions(model, () => ({
    messageApi,
    contextHolder: () => contextHolder,
  }));

  actions.useAction(Lifecycle.Fault, (context, payload) => {
    switch (payload.reason) {
      case Reason.Aborted:
        context.data.messageApi.info(payload.error.message);
        break;
      case Reason.Errored:
        context.data.messageApi.error(payload.error.message);
        break;
    }
  });

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

  actions.useAction(Actions.AddUser, async (context) => {
    await context.actions.resource(resource.promoteUser());
  });

  actions.useAction(Actions.DeleteUser, async (context) => {
    try {
      await context.actions.resource(resource.deleteUser());
    } catch (error) {
      if (isHTTPError(error) && error.response.status === 404) {
        context.actions.produce((draft) => {
          draft.model.deleteUser = true;
        });
        return;
      }
      throw error;
    }
  });

  return actions;
}
