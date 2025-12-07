import { useAction, useActions, Operation } from "../../library/index.ts";
import { use } from "../../library/use/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { Model, Actions } from "./types.ts";

const model = <Model>{
  count: 1,
};

export function useCounterActions() {
  const resetAction = useAction<Model, typeof Actions.Reset>(
    (context, payload) => {
      context.actions.produce((model) => {
        model.count = payload;
      });
    },
  );

  const incrementAction = useAction<Model, typeof Actions.Increment>(
    async (context) => {
      context.actions.produce((model) => {
        model.count = context.actions.annotate(
          Operation.Update,
          model.count + 1,
        );
      });

      await sleep(1_000);

      context.actions.produce((model) => {
        model.count += 1;
      });
    },
  );

  const decrementAction = useAction<Model, typeof Actions.Decrement>(
    (context) => {
      context.actions.produce((model) => {
        model.count -= 1;
      });
    },
  );

  return useActions<Model, typeof Actions>(
    model,
    class {
      [Actions.Reset] = resetAction;

      @use.serial()
      [Actions.Increment] = incrementAction;
      [Actions.Decrement] = decrementAction;
    },
  );
}
