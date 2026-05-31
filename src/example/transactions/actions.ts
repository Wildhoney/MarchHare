import { Operation } from "march-hare";
import { app } from "../app.ts";
import { Actions, type Model } from "./types.ts";
import * as resource from "./resources.ts";

const initialModel: Model = { items: [], cursor: null, hasMore: true };

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();

  const actions = context.useActions(initialModel);

  actions.useAction(Actions.Mount, async (context) => {
    context.actions.produce(
      ({ model }) =>
        void (model.items = context.actions.annotate(
          model.items,
          Operation.Update,
        )),
    );

    const transactions = await context.actions.resource(
      resource.transactions({ cursor: null }),
    );
    await context.actions.dispatch(
      Actions.Broadcast.TransactionsLoaded,
      transactions.items,
    );

    context.actions.produce(({ model }) => {
      model.items = transactions.items;
      model.cursor = transactions.nextCursor;
      model.hasMore = transactions.nextCursor !== null;
    });
  });

  actions.useAction(Actions.LoadMore, async (context) => {
    if (!context.model.hasMore) return;
    if (context.actions.inspect.items.pending()) return;

    const cursor = context.model.cursor;
    context.actions.produce(
      ({ model }) =>
        void (model.items = context.actions.annotate(
          model.items,
          Operation.Update,
        )),
    );

    const transactions = await context.actions.resource(
      resource.transactions({ cursor }),
    );
    await context.actions.dispatch(
      Actions.Broadcast.TransactionsLoaded,
      transactions.items,
    );

    context.actions.produce(({ model }) => {
      model.items.push(...transactions.items);
      model.cursor = transactions.nextCursor;
      model.hasMore = transactions.nextCursor !== null;
    });
  });

  actions.useAction(Actions.Refresh, async (context) => {
    context.actions.produce(
      ({ model }) =>
        void (model.items = context.actions.annotate(
          model.items,
          Operation.Update,
        )),
    );

    const transactions = await context.actions.resource(
      resource.transactions({ cursor: null }),
    );
    await context.actions.dispatch(
      Actions.Broadcast.TransactionsLoaded,
      transactions.items,
    );

    context.actions.produce(({ model }) => {
      model.items = transactions.items;
      model.cursor = transactions.nextCursor;
      model.hasMore = transactions.nextCursor !== null;
    });
  });

  return actions;
}
