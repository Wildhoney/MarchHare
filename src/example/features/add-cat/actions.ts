import { G } from "@mobily/ts-belt";
import { Actions, type Model } from "./types.ts";
import { scope } from "./utils.ts";
import { type Payload } from "@example/shared/types/index.ts";
import * as resource from "@example/shared/resources/index.ts";
import { name } from "@example/shared/utils/name/index.ts";

export function useActions() {
  const context = scope.useContext<Model, typeof Actions>();
  const actions = context.useActions({ image: null });

  actions.useAction(Actions.Click, async (context) => {
    context.actions.produce(({ model, inspect }) => {
      model.image = context.actions.annotate(inspect.image.draft());
    });

    const [image] = await context.actions.resource(resource.cat.image());
    if (G.isNullable(image)) return;

    context.actions.produce(({ model }) => void (model.image = image));

    const cat: Payload.Cat = {
      id: image.id,
      name: name(),
      avatar: image.url,
    };
    await context.actions.dispatch(Actions.Broadcast.Cat.Added, cat);
  });

  return actions;
}
