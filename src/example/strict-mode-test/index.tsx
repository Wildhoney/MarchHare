import * as React from "react";
import {
  useActions,
  Action,
  Lifecycle,
  annotate,
  Operation,
} from "../../library/index.ts";

type Model = {
  name: string | null;
  count: number;
};

class Actions {
  static SetName = Action<string>("SetName");
  static Increment = Action("Increment");
}

const model: Model = {
  name: annotate(Operation.Update, null),
  count: 0,
};

function StrictModeFixture(): React.ReactElement {
  const mountCountRef = React.useRef(0);
  const handlerCountRef = React.useRef(0);
  const [, forceRender] = React.useState(0);

  const result = useActions<Model, typeof Actions>(model);

  result.useAction(Lifecycle.Mount, () => {
    mountCountRef.current++;
    forceRender((n) => n + 1);
  });

  result.useAction(Actions.SetName, (context, name) => {
    context.actions.produce(({ model }) => {
      model.name = name;
    });
  });

  result.useAction(Actions.Increment, (context) => {
    handlerCountRef.current++;
    forceRender((n) => n + 1);
    context.actions.produce((draft) => {
      draft.model.count = draft.model.count + 1;
    });
  });

  return (
    <div>
      <span data-testid="mount-count">{mountCountRef.current}</span>
      <span data-testid="handler-count">{handlerCountRef.current}</span>
      <span data-testid="pending">
        {String(result[1].inspect.name.pending())}
      </span>
      <span data-testid="name">{result[0].name ?? "null"}</span>
      <span data-testid="count">{result[0].count}</span>
      <button
        data-testid="set-name"
        onClick={() => result[1].dispatch(Actions.SetName, "Adam")}
      >
        Set Name
      </button>
      <button
        data-testid="increment"
        onClick={() => result[1].dispatch(Actions.Increment)}
      >
        Increment
      </button>
    </div>
  );
}

export default function StrictModeTest(): React.ReactElement {
  return (
    <React.StrictMode>
      <StrictModeFixture />
    </React.StrictMode>
  );
}
