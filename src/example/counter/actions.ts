import { useAction, useActions, Operation, use, Abort } from "../../library/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { Model, Actions } from "./types.ts";

const model = <Model>{
  count: 1,
};

export function useCounterActions() {
  const incrementAction = useAction<Model, typeof Actions, "Increment">(
    async (context) => {
      context.actions.produce((draft) => {
        if (draft.inspect.count.draft() === 10) {
          console.log('done', draft.inspect.count.draft());
          context.abort(Abort.Named, Actions.Increment);
          return;
        }

        draft.model.count = context.actions.annotate(
          Operation.Update,
          draft.inspect.count.draft() + 1,
        );
      });

      await sleep(1_000, context.signal);

      context.actions.produce((draft) => {
        draft.model.count = draft.model.count + 1;
      });
    },
  );

  const decrementAction = useAction<Model, typeof Actions, "Decrement">(
    (context) => {
      context.actions.produce((draft) => {
        draft.model.count = draft.inspect.count.draft() - 1;
      });
    },
  );

  return useActions<Model, typeof Actions>(
    model,
    class {
      // @use.poll<Model, typeof Actions>(500)
      [Actions.Increment] = incrementAction;
      [Actions.Decrement] = decrementAction;
    },
  );
}
