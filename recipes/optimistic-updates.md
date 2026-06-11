# Optimistic updates

Optimistic updates show the user the expected outcome of an action immediately, without waiting for the server. They are made safe by three primitives that already exist in the library:

- **`utils.pk()`** &mdash; generates a unique placeholder identifier that survives concurrent reorders.
- **Model annotations** &mdash; mark a field as in-flight so the view can show a pending hint, and let concurrent handlers read the latest draft rather than the committed value.
- **`Lifecycle.Error()`** (or a `try`/`catch` inside the handler) &mdash; rolls the model back when the server rejects the change.

This recipe ties them together. For the individual primitives see [utility-functions.md](./utility-functions.md), [model-annotations.md](./model-annotations.md), and [error-handling.md](./error-handling.md).

## Create with a placeholder identifier

The pattern: push the new row into the model with a `utils.pk()` symbol, fire the request, then swap the symbol for the server-assigned identifier when it lands.

```ts
import { Action, Lifecycle, Op, Reason, utils, type Pk } from "march-hare";
import { app } from "./app";

type Todo = {
  id: Pk<number>;
  text: string;
};

type Model = {
  todos: Todo[];
};

export class Actions {
  static Error = Lifecycle.Error();
  static Create = Action<string>("Create");
}

export function useTodoActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ todos: [] });

  actions.useAction(Actions.Create, async (context, text) => {
    const id = utils.pk();

    context.actions.produce(({ model }) => {
      model.todos.push({
        id,
        text: context.actions.annotate(text, Op.Create),
      });
    });

    const todo = await api.createTodo(
      { text },
      {
        signal: context.task.controller.signal,
      },
    );

    context.actions.produce(({ model }) => {
      const created = model.todos.find((todo) => todo.id === id);
      if (!created) return;
      created.id = todo.id;
      created.text = todo.text;
    });
  });

  return actions;
}
```

`utils.pk()` returns a fresh `symbol`. Because symbols are reference-unique, the placeholder survives concurrent inserts: even if two creates land out of order, each handler finds its own row by the symbol it generated. The `Pk<number>` type widens the field to `symbol | number | undefined`, so the same property holds the placeholder during the optimistic phase and the real identifier after reconciliation.

The annotation on `text` is what the view reads to dim the row, show a spinner, or disable the inline editor while the request is in flight. See [Showing the pending state](#showing-the-pending-state) below.

## Roll back on failure

Two equivalent strategies. Pick whichever fits the handler's shape.

**Strategy 1: `try`/`catch` inside the handler.** Keeps the rollback colocated with the optimistic write:

```ts
actions.useAction(Actions.Create, async (context, text) => {
  const id = utils.pk();

  context.actions.produce(({ model }) => {
    model.todos.push({ id, text: context.actions.annotate(text, Op.Create) });
  });

  try {
    const todo = await api.createTodo(
      { text },
      {
        signal: context.task.controller.signal,
      },
    );
    context.actions.produce(({ model }) => {
      const created = model.todos.find((todo) => todo.id === id);
      if (!created) return;
      created.id = todo.id;
      created.text = todo.text;
    });
  } catch (error) {
    context.actions.produce(({ model }) => {
      model.todos = model.todos.filter((todo) => todo.id !== id);
    });
    throw error;
  }
});
```

The `throw` keeps the failure visible to `Lifecycle.Fault` / `Lifecycle.Error` so app-level reporting still runs &mdash; the rollback is for the model, not for swallowing the error.

**Strategy 2: roll back from `Lifecycle.Error`.** Useful when several actions share the same recovery, or when the optimistic write happens in one action and the rollback should fire for any action against the same row. The placeholder needs to be reachable from the error handler; the simplest shape is to put it on the model:

```ts
// Reason is imported above

type Model = {
  todos: Todo[];
  creatingId: symbol | null;
};

actions.useAction(Actions.Create, async (context, text) => {
  const id = utils.pk();
  context.actions.produce(({ model }) => {
    model.creatingId = id;
    model.todos.push({ id, text: context.actions.annotate(text, Op.Create) });
  });

  const todo = await api.createTodo(
    { text },
    {
      signal: context.task.controller.signal,
    },
  );

  context.actions.produce(({ model }) => {
    const created = model.todos.find((todo) => todo.id === id);
    if (!created) return;
    created.id = todo.id;
    created.text = todo.text;
    model.creatingId = null;
  });
});

actions.useAction(Actions.Error, (context, fault) => {
  if (fault.reason !== Reason.Errored) return;
  context.actions.produce(({ model }) => {
    if (model.creatingId === null) return;
    model.todos = model.todos.filter((todo) => todo.id !== model.creatingId);
    model.creatingId = null;
  });
});
```

Choose strategy 1 unless a single rollback genuinely covers multiple actions &mdash; the colocated `try`/`catch` is easier to follow.

## Concurrent edits: read the draft, not the model

When two updates to the same field overlap, the second handler must build on the first handler's still-pending value, not the committed model. `inspect.<field>.draft()` returns the latest annotated value &mdash; or the committed model value if no annotation is in flight &mdash; so the second update applies to "what the user has been promised", not "what the server confirmed":

```ts
actions.useAction(
  Actions.Rename,
  async (context, payload: { id: number; text: string }) => {
    context.actions.produce(({ model }) => {
      const todo = model.todos.find((todo) => todo.id === payload.id);
      if (!todo) return;
      todo.text = context.actions.annotate(payload.text, Op.Update);
    });

    await api.renameTodo(payload, { signal: context.task.controller.signal });

    context.actions.produce(({ model }) => {
      const todo = model.todos.find((todo) => todo.id === payload.id);
      if (!todo) return;
      todo.text = payload.text;
    });
  },
);
```

If the user types `"foo"` then `"foobar"` in quick succession, the second handler reads the first handler's pending annotation via `inspect`. The view sees `"foobar"` immediately; whichever request settles last wins on the wire, but the local model never flickers back to a stale value mid-flight.

## Showing the pending state

The view side reads annotations through `actions.inspect`:

```tsx
function TodoRow({ todo }: { todo: Todo }) {
  const [, actions] = useTodoActions();
  const pending = actions.inspect.todos.pending();

  return (
    <li style={{ opacity: pending ? 0.5 : 1 }}>
      {todo.text}
      {actions.inspect.todos.is(Op.Create) && <Spinner />}
    </li>
  );
}
```

`pending()` is `true` while at least one annotation is in flight on that field. `is(Op.Create)` narrows to a specific operation &mdash; useful when the same field can be in the middle of a create, an update, or a delete and the UI hints differ.

## Optimistic delete

Delete is the mirror of create &mdash; remove the row immediately, restore it if the server rejects the change. Capture the row and its position from the read-only snapshot before mutating, so the rollback restores it where it was:

```ts
actions.useAction(Actions.Delete, async (context, id: number) => {
  const target = context.model.todos.find((todo) => todo.id === id);
  if (!target) return;
  const index = context.model.todos.indexOf(target);

  context.actions.produce(({ model }) => {
    model.todos = model.todos.filter((todo) => todo.id !== id);
  });

  try {
    await api.deleteTodo(id, { signal: context.task.controller.signal });
  } catch (error) {
    context.actions.produce(({ model }) => {
      model.todos.splice(index, 0, target);
    });
    throw error;
  }
});
```

`context.model` is a read-only snapshot taken at the moment the handler started, which is exactly what we want here &mdash; the row to restore is the row the user asked to delete, not whatever happens to be in the model after concurrent edits.

## When not to use optimistic updates

Optimistic updates are a UX win when the server is highly likely to accept the change and the cost of rolling back is small (a row flickers out of existence). They are a UX loss when:

- The server may reject the change for routine reasons (validation, permissions). The flicker on rollback teaches the user not to trust the UI.
- The change is destructive and the user might act on the optimistic state before the server confirms (e.g. navigating away assuming a transfer completed). Pessimistic updates with a clear loading state are safer.
- The action triggers downstream broadcast effects that other components react to. Rolling back the local model is straightforward; coordinating a rollback across every subscriber is not.

For those cases, dispatch the action, mark the field with `Op.Update` to lock the UI, and only update the value when the server confirms.
