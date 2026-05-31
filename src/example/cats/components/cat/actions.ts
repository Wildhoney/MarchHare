import { useRouter } from "react-wayfinder";
import { app } from "../../../app.ts";
import { Actions, type Data, type Model, type Props } from "./types.ts";
import { urls } from "../../utils.tsx";
import * as resource from "./resources.ts";
import { catHandler } from "./utils.ts";

export function useActions({ index }: Props) {
  const router = useRouter();

  const context = app.useContext<Model, typeof Actions, Data>();

  const actions = context.useActions({ cat: resource.cat({ id: 5 }) }, () => ({
    index,
    router,
  }));

  actions.useAction(Actions.Mount, catHandler);
  actions.useAction(Actions.Get, catHandler);

  actions.useAction(Actions.Next, (context) => {
    context.data.router.navigate(
      context.data.router.url(urls.cat, {
        index: context.data.index + 1,
      }),
    );
  });

  actions.useAction(Actions.Previous, (context) => {
    context.data.router.navigate(
      context.data.router.url(urls.cat, {
        index: Math.max(0, context.data.index - 1),
      }),
    );
  });

  return actions;
}
