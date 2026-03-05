# DOM Node Capture

Capture DOM nodes for direct access in handlers and components. When the model has a `meta.nodes` property, calling `actions.node()` automatically writes the captured node to the model &mdash; no manual `Lifecycle.Node` handler is needed.

## Setup

Include a `meta` property with `nodes` in your model using the `Meta` utility type:

```ts
import { useActions, Action } from "chizu";
import type { Meta } from "chizu";

type N = {
  input: HTMLInputElement;
  container: HTMLDivElement;
};

type Model = {
  count: number;
  meta: Meta.Nodes<N>;
};

const model: Model = {
  count: 0,
  meta: {
    nodes: {
      input: null,
      container: null,
    },
  },
};
```

The `Meta` utility type automatically adds `| null` to each node value, reflecting that DOM refs are `null` until captured via `actions.node()`.

## Capturing nodes

Attach refs in JSX using `actions.node(name, node)`:

```tsx
const [model, actions] = useActions<Model, typeof Actions>(model);

return (
  <div ref={(node) => actions.node("container", node)}>
    <input ref={(node) => actions.node("input", node)} />
  </div>
);
```

The first argument is the node name (must match a key on `meta.nodes`), and the second is the DOM node or `null`.

## Reading nodes

Nodes are accessible in three places:

```ts
// 1. From the model (in the component)
model.meta.nodes.input;

// 2. From the actions object (in the component)
actions.meta.nodes.input?.focus();

// 3. From the handler context
actions.useAction(Actions.Focus, (context) => {
  context.meta.nodes.input?.focus();
});
```

## Lifecycle.Node events

For imperative logic when a node is captured or released, use `Lifecycle.Node()`. It is a channeled lifecycle action &mdash; subscribe to all node changes or target a specific node by name:

```ts
import { Lifecycle } from "chizu";

class Actions {
  static Node = Lifecycle.Node();
  static Focus = Action("Focus");
}

// Subscribe to all node changes
actions.useAction(Actions.Node, (context, node) => {
  console.log("A node changed:", node);
});

// Subscribe to a specific node (channeled by Name)
actions.useAction(Actions.Node({ Name: "input" }), (context, node) => {
  if (node) {
    node.focus(); // Node was captured
  }
  // node is null when the element unmounts
});
```

The handler fires during `useLayoutEffect`, so the DOM node is fully attached when received.

## Full example

```tsx
import { useActions, Action, Lifecycle } from "chizu";
import type { Meta } from "chizu";

type N = {
  searchInput: HTMLInputElement;
};

type Model = {
  value: string;
  meta: Meta.Nodes<N>;
};

class Actions {
  static Node = Lifecycle.Node();
  static Mount = Lifecycle.Mount();
  static Search = Action<string>("Search");
}

function useSearchActions() {
  const actions = useActions<Model, typeof Actions>({
    value: "",
    meta: { nodes: { searchInput: null } },
  });

  // Auto-focus the input when it is captured
  actions.useAction(Actions.Node({ Name: "searchInput" }), (context, node) => {
    if (node) node.focus();
  });

  actions.useAction(Actions.Search, (context, query) => {
    context.actions.produce(({ model }) => {
      model.value = query;
    });
  });

  return actions;
}

export default function Search() {
  const [model, actions] = useSearchActions();

  return (
    <div>
      <input
        ref={(node) => actions.node("searchInput", node)}
        value={model.value}
        onChange={(e) => actions.dispatch(Actions.Search, e.target.value)}
      />
    </div>
  );
}
```

## How it works

1. `actions.node(name, node)` stores the reference immediately (accessible via `actions.meta.nodes`).
2. After render, a layout effect compares pending nodes against previously emitted values.
3. If a node changed, `meta.nodes` on the model is updated and `Lifecycle.Node` handlers fire with the node as payload and `{ Name: name }` as the channel.
4. When a component unmounts, React calls the ref callback with `null`, and the handler receives `null`.
