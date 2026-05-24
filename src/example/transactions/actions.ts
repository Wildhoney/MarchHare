import { Operation, useActions } from "../../library/index.ts";
import { Actions, type Model } from "./types.ts";
import * as resource from "./resources.ts";

const initialModel: Model = { items: [], cursor: null, hasMore: true };

export function useTransactionsActions() {
  const actions = useActions<Model, typeof Actions>(initialModel);

  actions.useAction(Actions.Mount, async (context) => {
    context.actions.produce(
      ({ model }) =>
        void (model.items = context.actions.annotate(
          model.items,
          Operation.Update,
        )),
    );

    const page = await context.actions.resource(resource.transactions, {
      cursor: null,
    });
    await context.actions.dispatch(
      Actions.Broadcast.TransactionsLoaded,
      page.items,
    );

    context.actions.produce(({ model }) => {
      model.items = page.items;
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  actions.useAction(Actions.LoadMore, async (context) => {
    if (!context.model.hasMore) return;
    if (actions[1].inspect.items.pending()) return;

    const cursor = context.model.cursor;
    context.actions.produce(
      ({ model }) =>
        void (model.items = context.actions.annotate(
          model.items,
          Operation.Update,
        )),
    );

    const page = await context.actions.resource(resource.transactions, {
      cursor,
    });
    await context.actions.dispatch(
      Actions.Broadcast.TransactionsLoaded,
      page.items,
    );

    context.actions.produce(({ model }) => {
      model.items.push(...page.items);
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
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

    const page = await context.actions.resource(resource.transactions, {
      cursor: null,
    });
    await context.actions.dispatch(
      Actions.Broadcast.TransactionsLoaded,
      page.items,
    );

    context.actions.produce(({ model }) => {
      model.items = page.items;
      model.cursor = page.nextCursor;
      model.hasMore = page.nextCursor !== null;
    });
  });

  return actions;
}
