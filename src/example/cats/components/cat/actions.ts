import { useContext } from "march-hare";
import { useRouter } from "react-wayfinder";
import { Actions, type Data, type Model, type Props } from "./types.ts";
import { urls } from "../../utils.tsx";
import { cat, getCat } from "./utils.ts";

export function useActions({ index }: Props) {
  const router = useRouter();

  const context = useContext<Model, typeof Actions, Data>();

  const actions = context.useActions({ cat: cat({ id: 5 }) }, () => ({
    index,
    router,
  }));

  actions.useAction(Actions.Mount, getCat);
  actions.useAction(Actions.Get, getCat);

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
