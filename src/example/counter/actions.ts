import { useActions, Operation } from "../../library/index.ts";
import { sleep } from "../../library/utils/index.ts";
import { DistributedActions } from "../types.ts";
import { Model, Actions } from "./types.ts";

const model: Model = {
  count: 1,
};

export function useCounterActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Increment, async (context) => {
    context.actions.produce((draft) => {
      draft.model.count = context.actions.annotate(
        Operation.Update,
        draft.inspect.count.draft() + 1,
      );
    });

    await sleep(1_000, context.task.controller.signal);

    context.actions.produce((draft) => {
      draft.model.count = draft.model.count + 1;
      context.actions.dispatch(DistributedActions.Counter, draft.model.count);
    });
  });

  actions.useAction(Actions.Decrement, (context) => {
    context.actions.produce((draft) => {
      draft.model.count = draft.model.count - 1;
      context.actions.dispatch(DistributedActions.Counter, draft.model.count);
    });
  });

  return actions;
}
