import { useActions, Lifecycle, Bound } from "../../library/index.ts";
import { Model, Actions, Country } from "./types.ts";

const model: Model = {
  visitor: null,
  history: [],
  source: null,
  connected: false,
};

export function useVisitorActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Lifecycle.Mount, (context) => {
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

  actions.useAction(Actions.Visitor, Bound("visitor"));

  // actions.useAction(Actions.Visitor, (context, country) => {
  //   context.actions.produce((draft) => {
  //     draft.model.visitor = country;
  //     draft.model.history = [...A.take([country, ...draft.model.history], 20)];
  //   });
  // });

  actions.useAction(Lifecycle.Unmount, (context) => {
    context.model.source?.close();
  });

  return actions;
}
