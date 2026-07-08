import { G } from "@mobily/ts-belt";
import { message } from "antd";
import { Actions, type Model } from "./types.ts";
import { scope } from "./utils.ts";
import { type Payload } from "@example/shared/types/index.ts";
import * as resource from "@example/shared/resources/index.ts";
import { name } from "@example/shared/utils/name/index.ts";
import { filter } from "@example/shared/utils/filter/index.ts";

export function useActions() {
  const context = scope.useContext<Model, typeof Actions>();
  const actions = context.useActions({ image: null });

  actions.useAction(resource.cat.image.action(), (_context, image) => {
    if (G.isNull(image)) return void message.info("A new cattery has opened");
    void message.success("Cat adopted");
  });

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
      filter: filter(),
    };
    await context.actions.dispatch(Actions.Broadcast.Cat.Added, cat);
  });

  return actions;
}
