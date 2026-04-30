import { Operation, useActions } from "../../library/index.ts";
import {
  Actions,
  SessionActions,
  type SessionModel,
  type ViewerModel,
} from "./types.ts";
import * as resource from "./resources.ts";
import type { Cat } from "./api.ts";

const initialSessionModel: SessionModel = { viewCount: 0, history: [] };

export function useViewerActions({ index }: { index: number }) {
  const actions = useActions<ViewerModel, typeof Actions>({ cat: null });
  const cat = actions.useResource(resource.cat);

  const load = async (
    annotate: () => void,
    commit: (data: Cat) => void,
  ): Promise<void> => {
    annotate();
    const data = await cat(index);
    commit(data);
  };

  actions.useAction(Actions.Mount, async (context) =>
    load(
      () =>
        context.actions.produce(({ model }) => {
          model.cat = context.actions.annotate(Operation.Update, model.cat);
        }),
      (data) =>
        context.actions.produce(({ model }) => {
          model.cat = data;
        }),
    ),
  );

  actions.useAction(Actions.Next, () => {
    window.navigation.navigate(`/cats/${index + 1}`);
  });

  actions.useAction(Actions.Previous, () => {
    window.navigation.navigate(`/cats/${Math.max(0, index - 1)}`);
  });

  actions.useAction(Actions.Refresh, async (context) =>
    load(
      () =>
        context.actions.produce(({ model }) => {
          model.cat = context.actions.annotate(Operation.Update, model.cat);
        }),
      (data) =>
        context.actions.produce(({ model }) => {
          model.cat = data;
        }),
    ),
  );

  return actions;
}

export function useSessionActions() {
  const actions = useActions<SessionModel, typeof SessionActions>(
    initialSessionModel,
  );

  actions.useAction(Actions.Broadcast.CatViewed, (context, id) => {
    context.actions.produce(({ model }) => {
      if (model.history[0] === id) return;
      model.history = [id, ...model.history.slice(0, 9)];
      model.viewCount += 1;
    });
  });

  return actions;
}
