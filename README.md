<div align="center">
  <img src="/media/logo.png" width="475" />

[![Checks](https://github.com/Wildhoney/Chizu/actions/workflows/checks.yml/badge.svg)](https://github.com/Wildhoney/Chizu/actions/workflows/checks.yml)

</div>

Strongly typed React framework using generators and efficiently updated views alongside the publish-subscribe pattern.

**[View Live Demo →](https://wildhoney.github.io/Chizu/)**

## Contents

1. [Benefits](#benefits)
1. [Getting started](#getting-started)
1. [Error handling](#error-handling)
1. [Model annotations](#model-annotations)
1. [Lifecycle actions](#lifecycle-actions)
1. [Distributed actions](#distributed-actions)
1. [Action decorators](#action-decorators)

## Benefits

- Finely tuned and thoughtful event-driven architecture superset of [React](https://react.dev/).
- Super efficient with views only re-rendering when absolutely necessary.
- Built-in support for [optimistic updates](https://medium.com/@kyledeguzmanx/what-are-optimistic-updates-483662c3e171) within components.
- Mostly standard JavaScript without quirky rules and exceptions.
- Clear separation of concerns between business logic and markup.
- Strongly typed throughout &ndash; dispatches, models, etc&hellip;
- Easily communicate between actions using distributed actions.
- Bundled decorators for common action functionality such as exclusive mode and reactive triggers.
- No need to worry about referential equality &ndash; reactive dependencies use primitives only.
- Built-in request cancellation with `AbortController` integration.
- Granular async state tracking per model field (pending, draft, operation type).
- Declarative lifecycle hooks without manual `useEffect` management.
- Centralised error handling for actions via the `Error` component.

## Getting started

Actions are responsible for mutating the state of the view. In the below example the `name` is dispatched from the view to the actions, the state is updated and the view is rendered with the updated value. We use the `Actions` type to ensure type safety for our actions class.

```tsx
const model: Model = {
  name: null,
};

export class Actions {
  static Name = createAction<string>();
}

export default function useNameActions() {
  return useActions<Model, typeof Actions>(
    model,
    class {
      [Actions.Name] = utils.set("name");
    },
  );
}
```

```tsx
export default function Profile(props: Props): React.ReactElement {
  const [model, actions] = useNameActions();

  return (
    <>
      <p>Hey {model.name}</p>

      <button onClick={() => actions.dispatch(Actions.Name, randomName())}>
        Switch profile
      </button>
    </>
  );
}
```

Notice `createAction<string>()` takes a generic to specify the payload type. When using `useAction`, the payload is accessible as the second argument after `context`. The third generic in `useAction<Model, typeof Actions, "Name">` extracts the correct payload type from the `Actions` class:

```tsx
export class Actions {
  static Name = createAction<string>();
}

const nameAction = useAction<Model, typeof Actions, "Name">(
  async (context, payload) => {
    // payload is correctly typed as `string`
  },
);
```

You can perform asynchronous operations in the action which will cause the associated view to render a second time &ndash; as we're starting to require more control in our actions we&apos;ll move to our own fine-tuned action instead of `utils.set`:

```tsx
const model: Model = {
  name: null,
};

export class Actions {
  static Name = createAction();
}

export default function useNameActions() {
  const nameAction = useAction<Model, typeof Actions, "Name">(
    async (context) => {
      context.actions.produce((draft) => {
        draft.name = null;
      });

      const name = await fetch(/* ... */);

      context.actions.produce((draft) => {
        draft.name = name;
      });
    },
  );

  return useActions<Model, typeof Actions>(
    model,
    class {
      [Actions.Name] = nameAction;
    },
  );
}
```

```tsx
export default function Profile(props: Props): React.ReactElement {
  const [model, actions] = useNameActions();

  return (
    <>
      <p>Hey {model.name}</p>

      <button onClick={() => actions.dispatch(Actions.Name)}>
        Switch profile
      </button>
    </>
  );
}
```

## Error handling

Chizu provides a simple way to catch errors that occur within your actions. Use the `Error` component to wrap your application and provide an error handler. The handler receives an `ErrorDetails` object containing information about the error:

```tsx
import { Error, Reason } from "chizu";

const App = () => (
  <Error
    handler={({ reason, error, action }) => {
      switch (reason) {
        case Reason.Timeout:
          console.warn(`Action "${action}" timed out:`, error.message);
          break;
        case Reason.Aborted:
          console.info(`Action "${action}" was aborted`);
          break;
        case Reason.Error:
          console.error(`Action "${action}" failed:`, error.message);
          break;
      }
    }}
  >
    <Profile />
  </Error>
);
```

The `ErrorDetails` object contains:

- **`reason`** &ndash; One of `Reason.Timeout` (action exceeded timeout set via `@use.timeout()`), `Reason.Aborted` (action was cancelled, e.g., by `@use.exclusive()`), or `Reason.Error` (an error thrown in your action handler).
- **`error`** &ndash; The `Error` object that was thrown.
- **`action`** &ndash; The name of the action that caused the error (e.g., `"Increment"`).

**Note:** For the `action` name to be meaningful, pass a name when creating actions:

```ts
export class Actions {
  static Increment = createAction("Increment");
  static Decrement = createAction("Decrement");
}
```

## Model annotations

Model annotations allow you to track the state of async operations on individual model fields. This is useful for showing loading indicators, optimistic updates, and tracking pending changes. Annotations are powered by [Immertation](https://github.com/Wildhoney/Immertation) &ndash; refer to its documentation for more details.

Use `context.actions.annotate` to mark a value with an operation type. The view can then inspect the field to check if it's pending, get the draft value, or check the operation type:

```ts
import { Op } from "chizu";

context.actions.produce((model) => {
  model.name = context.actions.annotate(Op.Update, "New Name");
});
```

In the view, use `actions.inspect` to check the state of annotated fields:

```ts
actions.inspect.name.pending(); // true if operation is in progress
actions.inspect.name.remaining(); // count of pending operations
actions.inspect.name.draft(); // the next value to be applied
actions.inspect.name.is(Op.Update); // check specific operation type
```

## Lifecycle actions

Chizu provides lifecycle actions that trigger at specific points in a component's lifecycle. Import `Lifecycle` from Chizu:

```ts
import { Lifecycle } from "chizu";

class {
  [Lifecycle.Mount] = mountAction;
  [Lifecycle.Node] = nodeAction;
  [Lifecycle.Unmount] = unmountAction;
}
```

- **`Lifecycle.Mount`** &ndash; Triggered once when the component mounts (`useLayoutEffect`).
- **`Lifecycle.Node`** &ndash; Triggered after the component renders (`useEffect`).
- **`Lifecycle.Unmount`** &ndash; Triggered when the component unmounts.

## Distributed actions

Distributed actions allow different components to communicate with each other. Unlike regular actions which are scoped to a single component, distributed actions are broadcast to all mounted components that have defined a handler for them.

To create a distributed action, use `createDistributedAction` instead of `createAction`. A good pattern is to define distributed actions in a shared class that other action classes can extend:

```ts
import { createAction, createDistributedAction } from "chizu";

export class DistributedActions {
  static SignedOut = createDistributedAction();
}

export class Actions extends DistributedActions {
  static Increment = createAction();
}
```

Any component that defines a handler for `DistributedActions.SignedOut` will receive the action when it's dispatched from any other component. For direct access to the broadcast emitter, use `useBroadcast()`:

```ts
import { useBroadcast } from "chizu";

const broadcast = useBroadcast();

// Emit a distributed action
broadcast.emit(DistributedActions.SignedOut, payload);

// Listen for a distributed action
broadcast.on(DistributedActions.SignedOut, (payload) => {
  // Handle the action...
});
```

## Action decorators

Chizu provides decorators to add common functionality to your actions. Import `use` from Chizu and apply decorators to action properties:

```ts
import { use } from "chizu";
```

### `use.exclusive()`

Ensures only one instance of an action runs at a time. When a new action is dispatched, any previous running instance is automatically aborted. Use `context.signal` to cancel in-flight requests. When an action is aborted, the error handler receives `Reason.Aborted`:

```ts
const searchAction = useAction<Model, typeof Actions, "Search">(
  async (context, query) => {
    const response = await fetch(`/search?q=${query}`, {
      signal: context.signal,
    });
  },
);

return useActions<Model, typeof Actions>(
  model,
  class {
    @use.exclusive()
    [Actions.Search] = searchAction;
  },
);
```

### `use.reactive(() => [dependencies])`

Automatically triggers an action when its dependencies change. Dependencies must be primitives (strings, numbers, booleans, etc.) which means you never have to worry about referential equality:

```ts
class {
  @use.reactive(() => [props.userId])
  [Actions.FetchUser] = fetchUserAction;
}
```

### `use.debug()`

Logs detailed timing information for debugging, including when the action started, how many `produce` calls were made, and total duration:

```ts
class {
  @use.debug()
  [Actions.Submit] = submitAction;
}
```

### `use.timeout(ms)`

Aborts the action if it exceeds the specified duration. Triggers the abort signal via `context.signal`, allowing the action to clean up gracefully. Useful for preventing stuck states and enforcing response time limits. When a timeout occurs, the error handler receives `Reason.Timeout`:

```ts
class {
  @use.timeout(5_000)
  [Actions.FetchData] = fetchDataAction;
}
```
