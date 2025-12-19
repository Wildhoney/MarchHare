import { useAction, useActions, Lifecycle } from "../../library/index.ts";
import { Model, Actions, Country } from "./types.ts";
import { A } from "@mobily/ts-belt";

const model: Model = {
  visitor: null,
  history: [],
  source: null,
  connected: false,
};

export function useVisitorActions() {
  const mountAction = useAction<Model, typeof Actions>((context) => {
    const source = new EventSource("/visitors");
    source.addEventListener("connected", () => {
      context.actions.produce(({ model }) => {
        model.connected = true;
      });
    });
    source.addEventListener("visitor", (event) => {
      context.actions.dispatch(
        Actions.Visitor,
        JSON.parse(event.data) as Country,
      );
    });
    source.addEventListener("error", () => {
      source.close();
    });
    context.actions.produce(({ model }) => {
      model.source = source;
    });
  });

  const visitorAction = useAction<Model, typeof Actions, "Visitor">(
    (context, country) => {
      context.actions.produce(({ model }) => {
        model.visitor = country;
        model.history = [...A.take([country, ...model.history], 20)];
      });
    },
  );

  const unmountAction = useAction<Model, typeof Actions>((context) => {
    context.model.source?.close();
  });

  return useActions<Model, typeof Actions>(
    model,
    class {
      [Lifecycle.Mount] = mountAction;
      [Actions.Visitor] = visitorAction;
      [Lifecycle.Unmount] = unmountAction;
    },
  );
}
