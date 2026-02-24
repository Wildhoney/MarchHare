# Real-time applications

Chizu's lifecycle actions make it easy to integrate with real-time data sources like Server-Sent Events (SSE), WebSockets, or any event-based API. Use `Lifecycle.Mount()` to establish connections and `Lifecycle.Unmount()` to clean them up.

Here's an example that tracks website visitors in real-time using SSE:

```ts
import { useActions, Lifecycle, Action } from "chizu";

type Country = { name: string; flag: string; timestamp: number };

type Model = {
  visitor: Country | null;
  history: Country[];
  source: EventSource | null;
};

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Visitor = Action<Country>("Visitor");
}

const model: Model = {
  visitor: null,
  history: [],
  source: null,
};

export function useVisitorActions() {
  const actions = useActions<Model, typeof Actions>(model);

  actions.useAction(Actions.Mount, (context) => {
    const source = new EventSource("/visitors");
    source.addEventListener("visitor", (event) => {
      context.actions.dispatch(
        Actions.Visitor,
        JSON.parse(event.data) as Country,
      );
    });
    context.actions.produce((draft) => {
      draft.model.source = source;
    });
  });

  actions.useAction(Actions.Visitor, (context, country) => {
    context.actions.produce((draft) => {
      draft.model.visitor = country;
      draft.model.history = [country, ...draft.model.history].slice(0, 20);
    });
  });

  actions.useAction(Actions.Unmount, (context) => {
    context.model.source?.close();
  });

  return actions;
}
```

Key patterns demonstrated:

- **Connection in `Lifecycle.Mount()`** &ndash; Establish the SSE connection when the component mounts, storing the `EventSource` in the model for later cleanup.
- **Event-driven dispatches** &ndash; When SSE events arrive, dispatch actions to update the model, triggering efficient re-renders.
- **Cleanup in `Lifecycle.Unmount()`** &ndash; Close the connection when the component unmounts to prevent memory leaks.
- **All handlers use `actions.useAction`** &ndash; Lifecycle handlers benefit from the same stable reference pattern as regular actions, with types pre-baked from the `useActions` call.

See the full implementation in the [Visitor example source code](https://github.com/Wildhoney/Chizu/blob/main/src/example/visitor/actions.ts).
