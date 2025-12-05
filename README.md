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
<!-- 1. [Distributed actions](#distributed-actions)
1. [Module dispatch](#module-dispatch)
1. [Associated context](#associated-context) -->

## Benefits

- Finely tuned and thoughtful event-driven architecture superset of [React](https://react.dev/).
- Super efficient with views only re-rendering when absolutely necessary.
- Built-in support for [optimistic updates](https://medium.com/@kyledeguzmanx/what-are-optimistic-updates-483662c3e171) within components.
- Mostly standard JavaScript without quirky rules and exceptions.
- Clear separation of concerns between business logic and markup.
- First-class support for skeleton loading using generators.
- Strongly typed throughout &ndash; dispatches, models, etc&hellip;
- Easily communicate between actions using distributed actions.
- Bundled decorators for common action functionality such as consecutive mode.

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

You can perform asynchronous operations in the action which will cause the associated view to render a second time &ndash; as we're starting to require more control in our actions we&apos;ll move to our own fine-tuned action:

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

Chizu provides a simple way to catch errors that occur within your actions. You can use the `ActionError` component to wrap your application and provide an error handler. This handler will be called whenever an error is thrown in an action.

```tsx
import { ActionError } from "chizu";

const App = () => (
  <ActionError handler={(error) => console.error(error)}>
    <Profile />
  </ActionError>
);
```

## Handling states

```ts
import { Op } from "chizu";

// Mark a value as pending with an operation
context.actions.produce((model) => {
  model.name = context.actions.annotate(Op.Update, "New Name");
});

// Check pending state
actions.inspect.name.pending(); // true

// Get remaining count of pending operations
actions.inspect.name.remaining(); // 1 (next: actions.inspect.name.draft())

// Check specific operation
actions.inspect.name.is(Op.Update); // true
```

<!-- However in the above example where the name is fetched asynchronously, there is no feedback to the user &ndash; we can improve that significantly by using the `module.actions.annotate` and `module.validate` helpers:

```tsx
export default <Actions<Module>>function Actions(module) {
  return {
    async *[Action.Name]() {
      yield module.actions.produce((draft) => {
        draft.name = module.actions.annotate(null);
      });

      const name = await fetch(/* ... */);
      return module.actions.produce((draft) => {
        draft.name = name;
      });
    },
  };
};
```

```tsx
export default function ProfileView(props: Props): React.ReactElement {
  return (
    <Scope<Module> using={{ module, actions, props }}>
      {(module) => (
        <>
          <p>Hey {module.model.name}</p>

          {module.validate.name.pending() && <p>Switching profiles&hellip;</p>}

          <button
            disabled={module.validate.name.is(State.Op.Update)}
            onClick={() => module.actions.dispatch([Action.Name])}
          >
            Switch profile
          </button>
        </>
      )}
    </Scope>
  );
}
```



## Distributed actions

Actions can communicate with other mounted actions using the `DistributedActions` approach. You can configure the enum and union type in the root of your application:

```ts
export enum DistributedAction {
  SignedOut = "distributed/signed-out",
}

export type DistributedActions = [DistributedAction.SignedOut];
```

Note that you must prefix the enum name with `distributed` for it to behave as a distributed event, otherwise it'll be considered a module event only. Once you have the distributed actions you simply need to augment the module actions union with the `DistributedActions` and use it as you do other actions:

```ts
export type Actions = DistributedActions | [Action.Task, string]; // etc...
```

## Module dispatch

In the eventuality that you have a component but don't want associated actions, models, etc&hellip; but want to still fire actions either the closest module or a distributed action, you can use the `useScoped` hook:

```ts
const module = useScoped<Module>();

// ...

module.actions.dispatch([Action.Task, "My task that needs to be done."]);
```

Alternatively you can pass the current module as a prop to your components using the `Scoped` helper:

```ts
export type Props = {
  module: Scoped<Module>;
};
```

## Associated context

In many cases you'll still want to retrieve contextual values from within actions &ndash; which you can do by using the `module.actions.context` function:

```tsx
export default <Actions<Module>>function Actions(module) {
  const context = module.actions.context({
    name: NameContext
  });

  return {
    [Action.Name](name) {
      return module.actions.produce((draft) => {
        draft.name = context.name;
      });
    },
  };
};
```

If you need the context values to be reactive and fire the `Lifecycle.Derive` method then simply add it to your `props` definition when you initialise your scoped component:

```tsx
export default function Profile(props: Props): React.ReactElement {
  const name = React.useContext(NameContext);

  return (
    <Scope<Module> using={{ model, actions, props: { ...props, name } }}>
      {(module) => (
        <>
          <p>Hey {module.model.name}</p>

          <button
            onClick={() => module.actions.dispatch([Action.Name, randomName()])}
          >
            Switch profile
          </button>
        </>
      )}
    </Scope>
  );
}
``` -->
