import { shared } from "march-hare";
import { G } from "@mobily/ts-belt";
import { Actions, type Model } from "./types.ts";
import { Env, type Payload } from "@example/shared/types/index.ts";
import * as resource from "@example/shared/resources/cat/index.ts";
import { name } from "@example/shared/utils/name/index.ts";

export function useAddCatActions() {
  const context = shared.useContext<Env.Cat, Model, typeof Actions>();
  const actions = context.useActions({ pending: false });

  actions.useAction(Actions.Click, async (context) => {
    context.actions.produce(({ model }) => void (model.pending = true));

    try {
      const [image] = await context.actions.resource(resource.image());
      if (G.isNullable(image)) return;

      const cat: Payload.Cat = {
        id: image.id,
        name: name(),
        avatar: image.url,
      };
      await context.actions.dispatch(Actions.Broadcast.CatAdded, cat);
    } finally {
      context.actions.produce(({ model }) => void (model.pending = false));
    }
  });

  return actions;
}
