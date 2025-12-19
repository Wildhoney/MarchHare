import { useAction, useActions, Operation } from "../../library/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { Model, Actions } from "./types.ts";

const model = <Model>{
  count: 1,
};

export function useCounterActions() {
  const incrementAction = useAction<Model, typeof Actions, "Increment">(
    async (context) => {
      context.actions.produce(({ model, inspect }) => {
        model.count = context.actions.annotate(
          Operation.Update,
          inspect.count.draft() + 1,
        );
      });

      await sleep(1_000, context.signal);

      context.actions.produce(({ model }) => {
        model.count = model.count + 1;
      });
    },
  );

  const decrementAction = useAction<Model, typeof Actions, "Decrement">(
    (context) => {
      context.actions.produce(({ model, inspect }) => {
        model.count = inspect.count.draft() - 1;
      });
    },
  );

  return useActions<Model, typeof Actions>(
    model,
    class {
      // @use.poll<Model, typeof Actions>(1_200)
      [Actions.Increment] = incrementAction;
      [Actions.Decrement] = decrementAction;
    },
  );
}
