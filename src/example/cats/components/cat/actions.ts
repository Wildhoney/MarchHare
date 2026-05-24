import { useActions } from "../../../../library/index.ts";
import { useRouter } from "react-wayfinder";
import { Actions, type Data, type Model, type Props } from "./types.ts";
import { urls } from "../../utils.tsx";
import { resources } from "./utils.ts";

export function useCatActions({ index }: Props) {
  const router = useRouter();

  const actions = useActions<Model, typeof Actions, Data>(
    { cat: resources.cat.get() },
    () => ({ index, router }),
  );

  actions.useAction(Actions.Mount, async (context) => {
    const data = await context.actions
      .resource(resources.cat)
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.cat = data));
  });

  actions.useAction(Actions.Refresh, async (context) => {
    const data = await context.actions
      .resource(resources.cat)
      .exceeds({ minutes: 5 });
    context.actions.produce(({ model }) => void (model.cat = data));
  });

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
