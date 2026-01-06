import { useAction, useActions, Operation } from "../../library/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { DistributedActions } from "../types.ts";
import { Model, Actions, Action } from "./types.ts";

const model: Model = {
  count: 1,
};

export function useCounterActions() {
  const increment = useAction<Action, "Increment">(async (context) => {
    context.actions.produce((draft) => {
      context.signal;

      draft.model.count = context.actions.annotate(
        Operation.Update,
        draft.inspect.count.draft() + 1,
      );
    });

    await sleep(1_000, context.signal);

    context.actions.produce((draft) => {
      draft.model.count = draft.model.count + 1;
      context.actions.dispatch(DistributedActions.Counter, draft.model.count);
    });
  });

  const decrement = useAction<Action, "Decrement">((context) => {
    context.actions.produce((draft) => {
      draft.model.count = draft.inspect.count.draft() - 1;
      context.actions.dispatch(DistributedActions.Counter, draft.model.count);
    });
  });

  return useActions<Action>(
    model,
    class {
      [Actions.Increment] = increment;
      [Actions.Decrement] = decrement;
    },
  );
}
