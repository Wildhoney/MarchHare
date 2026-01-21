/**
 * E2E Test Fixtures for Rules 27-31: Type Safety
 *
 * Rule 27: Use Pk<T> for primary keys with optimistic updates
 * Rule 28: Let TypeScript infer handler payload types
 * Rule 29: Use Op to specify annotation operations
 * Rule 30: Use inspect to check annotation status
 * Rule 31: Use Box<T> for passing reactive state slices
 */
import * as React from "react";
import {
  Action,
  useActions,
  Op,
  utils,
  type Pk,
  type Box,
} from "../../../src/library/index.ts";

class TypeSafetyActions {
  static AddTodo = Action<string>("AddTodo");
  static UpdateTodo = Action<{ id: Pk<number>; text: string }>("UpdateTodo");
  static DeleteTodo = Action<Pk<number>>("DeleteTodo");
  static CompleteTodo = Action<Pk<number>>("CompleteTodo");
  static ConfirmTodo = Action<{ tempId: symbol; realId: number }>(
    "ConfirmTodo",
  );
  static AnnotatedUpdate = Action<string>("AnnotatedUpdate");
}

type Todo = {
  id: Pk<number>;
  text: string;
  completed: boolean;
};

type TypeSafetyModel = {
  todos: Todo[];
  annotatedValue: string;
  lastAddedId: string;
};

/**
 * Custom hook for Rule 27: Pk<T> for primary keys
 */
function useRule27Actions() {
  const actions = useActions<TypeSafetyModel, typeof TypeSafetyActions>({
    todos: [],
    annotatedValue: "",
    lastAddedId: "",
  });

  // Optimistic add with temporary symbol key
  actions.useAction(TypeSafetyActions.AddTodo, async (context, text) => {
    const tempId = utils.pk(); // Generate symbol key

    // Optimistically add with temp id
    context.actions.produce((draft) => {
      draft.model.todos.push({ id: tempId, text, completed: false });
      draft.model.lastAddedId = String(tempId);
    });

    // Simulate API call
    await utils.sleep(500);

    // Replace temp id with real id
    const realId = Math.floor(Math.random() * 10000);
    context.actions.produce((draft) => {
      const todo = draft.model.todos.find((t) => t.id === tempId);
      if (todo) {
        todo.id = realId;
        draft.model.lastAddedId = String(realId);
      }
    });
  });

  actions.useAction(TypeSafetyActions.UpdateTodo, (context, { id, text }) => {
    context.actions.produce((draft) => {
      const todo = draft.model.todos.find((t) => t.id === id);
      if (todo) {
        todo.text = text;
      }
    });
  });

  actions.useAction(TypeSafetyActions.DeleteTodo, (context, id) => {
    context.actions.produce((draft) => {
      draft.model.todos = draft.model.todos.filter((t) => t.id !== id);
    });
  });

  actions.useAction(TypeSafetyActions.CompleteTodo, (context, id) => {
    context.actions.produce((draft) => {
      const todo = draft.model.todos.find((t) => t.id === id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    });
  });

  return actions;
}

/**
 * Rule 27 Test: Pk<T> for primary keys
 * Demonstrates optimistic updates with temporary symbol keys
 */
function Rule27PrimaryKeys() {
  const [model, actions] = useRule27Actions();

  return (
    <section data-testid="rule-27">
      <h3>Rule 27: Pk&lt;T&gt; Primary Keys</h3>
      <div data-testid="rule-27-count">{model.todos.length}</div>
      <div data-testid="rule-27-last-id">{model.lastAddedId}</div>
      <div data-testid="rule-27-todos">
        {model.todos.map((todo, i) => (
          <div key={String(todo.id)} data-testid={`rule-27-todo-${i}`}>
            <span data-testid={`rule-27-todo-${i}-id`}>
              {typeof todo.id === "symbol" ? "temp" : todo.id}
            </span>
            <span data-testid={`rule-27-todo-${i}-text`}>{todo.text}</span>
            <span data-testid={`rule-27-todo-${i}-type`}>
              {typeof todo.id === "symbol" ? "symbol" : "number"}
            </span>
          </div>
        ))}
      </div>
      <button
        data-testid="rule-27-add"
        onClick={() => actions.dispatch(TypeSafetyActions.AddTodo, "New Todo")}
      >
        Add Todo
      </button>
    </section>
  );
}

/**
 * Custom hook for Rules 29 & 30: Op annotations and inspect
 */
function useRule29And30Actions() {
  const actions = useActions<TypeSafetyModel, typeof TypeSafetyActions>({
    todos: [],
    annotatedValue: "initial",
    lastAddedId: "",
  });

  actions.useAction(
    TypeSafetyActions.AnnotatedUpdate,
    async (context, newValue) => {
      // Rule 29: Use Op to specify annotation operations
      context.actions.produce((draft) => {
        draft.model.annotatedValue = context.actions.annotate(
          Op.Update,
          newValue,
        );
      });

      // Simulate async operation
      await utils.sleep(800);

      // Complete the update
      context.actions.produce((draft) => {
        draft.model.annotatedValue = newValue;
      });
    },
  );

  return actions;
}

/**
 * Rule 29 & 30 Test: Op annotations and inspect
 */
function Rule29And30Annotations() {
  const [model, actions] = useRule29And30Actions();

  // Rule 30: Use inspect to check annotation status
  const isPending = actions.inspect.annotatedValue.pending();
  const draftValue = actions.inspect.annotatedValue.draft();
  const remaining = actions.inspect.todos.remaining();

  return (
    <section data-testid="rule-29-30">
      <h3>Rules 29 & 30: Annotations and Inspect</h3>
      <div data-testid="rule-29-30-value">{model.annotatedValue}</div>
      <div data-testid="rule-29-30-pending">
        {isPending ? "pending" : "settled"}
      </div>
      <div data-testid="rule-29-30-draft">{String(draftValue)}</div>
      <div data-testid="rule-29-30-remaining">{remaining}</div>
      <button
        data-testid="rule-29-30-update"
        onClick={() =>
          actions.dispatch(TypeSafetyActions.AnnotatedUpdate, "updated-value")
        }
      >
        Update with Annotation
      </button>

      {/* Show Op values for reference */}
      <div data-testid="rule-29-30-ops">
        Op.Add={Op.Add}, Op.Update={Op.Update}, Op.Remove={Op.Remove}
      </div>
    </section>
  );
}

/**
 * Rule 31 Test: Box<T> for passing reactive state slices
 */
type UserData = {
  name: string;
  email: string;
};

type BoxModel = {
  user: UserData;
  counter: number;
};

class BoxActions {
  static UpdateUser = Action<Partial<UserData>>("UpdateUser");
  static IncrementCounter = Action("IncrementCounter");
}

// Child component that receives a Box<UserData>
function UserCard({ user }: { user: Box<UserData> }) {
  const isPending = user.inspect.pending();

  return (
    <div data-testid="rule-31-user-card">
      <div data-testid="rule-31-user-name">{user.value.name}</div>
      <div data-testid="rule-31-user-email">{user.value.email}</div>
      <div data-testid="rule-31-user-pending">
        {isPending ? "pending" : "idle"}
      </div>
    </div>
  );
}

// Child component that receives a Box<number>
function CounterDisplay({ counter }: { counter: Box<number> }) {
  return (
    <div data-testid="rule-31-counter-display">
      <div data-testid="rule-31-counter-value">{counter.value}</div>
      <div data-testid="rule-31-counter-pending">
        {counter.inspect.pending() ? "pending" : "idle"}
      </div>
    </div>
  );
}

/**
 * Custom hook for Rule 31: Box<T> slices
 */
function useRule31Actions() {
  const actions = useActions<BoxModel, typeof BoxActions>({
    user: { name: "Alice", email: "alice@example.com" },
    counter: 0,
  });

  actions.useAction(BoxActions.UpdateUser, async (context, updates) => {
    // Annotate the update
    context.actions.produce((draft) => {
      draft.model.user = context.actions.annotate(Op.Update, {
        ...draft.model.user,
        ...updates,
      });
    });

    await utils.sleep(500);

    context.actions.produce((draft) => {
      draft.model.user = { ...draft.model.user, ...updates };
    });
  });

  actions.useAction(BoxActions.IncrementCounter, async (context) => {
    context.actions.produce((draft) => {
      draft.model.counter = context.actions.annotate(
        Op.Update,
        draft.model.counter + 1,
      );
    });

    await utils.sleep(300);

    context.actions.produce((draft) => {
      draft.model.counter += 1;
    });
  });

  return actions;
}

function Rule31BoxSlices() {
  const [model, actions] = useRule31Actions();

  // Create Box slices for child components
  const userBox: Box<UserData> = {
    value: model.user,
    inspect: actions.inspect.user,
  };

  const counterBox: Box<number> = {
    value: model.counter,
    inspect: actions.inspect.counter,
  };

  return (
    <section data-testid="rule-31">
      <h3>Rule 31: Box&lt;T&gt; Slices</h3>
      <UserCard user={userBox} />
      <CounterDisplay counter={counterBox} />
      <button
        data-testid="rule-31-update-user"
        onClick={() => actions.dispatch(BoxActions.UpdateUser, { name: "Bob" })}
      >
        Update User Name
      </button>
      <button
        data-testid="rule-31-increment"
        onClick={() => actions.dispatch(BoxActions.IncrementCounter)}
      >
        Increment Counter
      </button>
    </section>
  );
}

/**
 * Rule 28 is about TypeScript inference - demonstrated implicitly
 * by the fact that all handlers above work without explicit type annotations
 */
function Rule28TypeInference() {
  return (
    <section data-testid="rule-28">
      <h3>Rule 28: Type Inference</h3>
      <p>
        Rule 28 demonstrates that TypeScript infers payload types from Action
        definitions. This is verified at compile-time. All handlers in this
        fixture use inferred types without explicit annotations.
      </p>
      <div data-testid="rule-28-verified">type-inference-verified</div>
    </section>
  );
}

export function TypeSafetyFixture() {
  return (
    <div data-testid="type-safety-fixture">
      <h2>Rules 27-31: Type Safety</h2>
      <Rule27PrimaryKeys />
      <Rule28TypeInference />
      <Rule29And30Annotations />
      <Rule31BoxSlices />
    </div>
  );
}
