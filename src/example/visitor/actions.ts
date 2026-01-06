import { useAction, useActions, Lifecycle } from "../../library/index.ts";
import { Model, Actions, Country, Action } from "./types.ts";
import { A } from "@mobily/ts-belt";

const model: Model = {
  visitor: null,
  history: [],
  source: null,
  connected: false,
};

export function useVisitorActions() {
  const mount = useAction<Action>((context) => {
    const source = new EventSource("/visitors");
    source.addEventListener("connected", () => {
      context.actions.produce((draft) => {
        draft.model.connected = true;
      });
    });
    source.addEventListener("visitor", (event) => {
      context.actions.dispatch(
        Actions.Visitor,
        <Country>JSON.parse(event.data),
      );
    });
    source.addEventListener("error", () => {
      source.close();
    });
    context.actions.produce((draft) => {
      draft.model.source = source;
    });
  });

  const visitor = useAction<Action, "Visitor">((context, country) => {
    context.actions.produce((draft) => {
      draft.model.visitor = country;
      draft.model.history = [...A.take([country, ...draft.model.history], 20)];
    });
  });

  const unmount = useAction<Action>((context) => {
    context.model.source?.close();
  });

  return useActions<Action>(
    model,
    class {
      [Lifecycle.Mount] = mount;
      [Actions.Visitor] = visitor;
      [Lifecycle.Unmount] = unmount;
    },
  );
}
