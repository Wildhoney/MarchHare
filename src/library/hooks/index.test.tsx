import { describe, expect, it } from "@jest/globals";
import { renderHook, act, render, screen } from "@testing-library/react";
import { useActions } from "./index.ts";
import { Action } from "../action/index.ts";
import { Distribution, Phase } from "../types/index.ts";
import { Broadcaster } from "../boundary/components/broadcast/index.tsx";
import { Consumer } from "../boundary/components/consumer/index.tsx";
import * as React from "react";

type Model = { value: string | null };

class Actions {
  static Update = Action<string>("Update");
}

class DistributedActions {
  static Counter = Action<number>("Counter", Distribution.Broadcast);
}

const model: Model = { value: null };

describe("useActions() data callback", () => {
  it("should provide data values via context.data", async () => {
    const capturedData: { external?: string } = {};

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof Actions, { external: string }>(
        model,
        () => ({ external: "test-value" }),
      );

      actions.useAction(Actions.Update, (context) => {
        capturedData.external = context.data.external;
        context.actions.produce((draft) => {
          draft.model.value = context.data.external;
        });
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    expect(capturedData.external).toBe("test-value");
    expect(result.current[0].value).toBe("test-value");
  });

  it("should provide latest data values even after rerender", async () => {
    const capturedValues: string[] = [];
    let externalValue = "initial";

    const { result, rerender } = renderHook(() => {
      const actions = useActions<Model, typeof Actions, { external: string }>(
        model,
        () => ({ external: externalValue }),
      );

      actions.useAction(Actions.Update, (context) => {
        capturedValues.push(context.data.external);
      });

      return actions;
    });

    // First dispatch with initial value
    await act(async () => {
      result.current[1].dispatch(Actions.Update, "first");
    });

    expect(capturedValues[0]).toBe("initial");

    // Update external value and rerender
    externalValue = "updated";
    rerender();

    // Second dispatch should see updated value
    await act(async () => {
      result.current[1].dispatch(Actions.Update, "second");
    });

    expect(capturedValues[1]).toBe("updated");
  });

  it("should work without data callback (empty data)", async () => {
    let dataReceived = false;

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof Actions>(model);

      actions.useAction(Actions.Update, (context) => {
        // Data should be an empty object when no callback is provided
        dataReceived = typeof context.data === "object";
        context.actions.produce((draft) => {
          draft.model.value = "updated";
        });
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    expect(dataReceived).toBe(true);
    expect(result.current[0].value).toBe("updated");
  });

  it("should handle multiple data properties", async () => {
    const captured: { a?: number; b?: string; c?: boolean } = {};

    const { result } = renderHook(() => {
      const actions = useActions<
        Model,
        typeof Actions,
        { a: number; b: string; c: boolean }
      >(model, () => ({ a: 42, b: "hello", c: true }));

      actions.useAction(Actions.Update, (context) => {
        captured.a = context.data.a;
        captured.b = context.data.b;
        captured.c = context.data.c;
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    expect(captured.a).toBe(42);
    expect(captured.b).toBe("hello");
    expect(captured.c).toBe(true);
  });

  it("should provide fresh data values across multiple dispatches", async () => {
    const capturedValues: string[] = [];
    let externalValue = "initial";

    const { result, rerender } = renderHook(() => {
      const actions = useActions<Model, typeof Actions, { external: string }>(
        model,
        () => ({ external: externalValue }),
      );

      actions.useAction(Actions.Update, async (context) => {
        // Simulate async operation
        await Promise.resolve();

        // Capture value after async - should be latest due to data proxy
        capturedValues.push(context.data.external);
      });

      return actions;
    });

    // First dispatch
    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    expect(capturedValues[0]).toBe("initial");

    // Change external value and rerender
    externalValue = "changed";
    rerender();

    // Second dispatch should see updated value
    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    // The data should provide the latest value
    expect(capturedValues[1]).toBe("changed");
  });
});

describe("useActions() distributed action mount behavior", () => {
  it("should invoke distributed action handler with cached value on mount", async () => {
    const capturedPayloads: number[] = [];

    type CounterModel = { count: number };
    const counterModel: CounterModel = { count: 0 };

    function ProducerComponent({ onShowLate }: { onShowLate: () => void }) {
      const actions = useActions<CounterModel, typeof DistributedActions>(
        counterModel,
      );

      actions.useAction(DistributedActions.Counter, (context, payload) => {
        context.actions.produce((draft) => {
          draft.model.count = payload;
        });
      });

      return (
        <>
          {/* consume() creates a Partition that stores dispatched values in consumer Map */}
          {actions[1].consume(DistributedActions.Counter, () => null)}
          <button
            data-testid="dispatch"
            onClick={() => {
              actions[1].dispatch(DistributedActions.Counter, 42);
              onShowLate();
            }}
          >
            Dispatch
          </button>
        </>
      );
    }

    function LateComponent() {
      const actions = useActions<CounterModel, typeof DistributedActions>(
        counterModel,
      );

      actions.useAction(DistributedActions.Counter, (_context, payload) => {
        capturedPayloads.push(payload);
      });

      return <div data-testid="late">Late Component</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <Consumer>
            <ProducerComponent onShowLate={() => setShow(true)} />
            {show && <LateComponent />}
          </Consumer>
        </Broadcaster>
      );
    }

    render(<App />);

    // Dispatch from producer and mount late component
    await act(async () => {
      screen.getByTestId("dispatch").click();
    });

    // Wait for effects to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // The late component should have received the cached value on mount
    // (excluding the dispatch that occurred when both were mounted)
    expect(capturedPayloads).toContain(42);
  });

  it("should invoke distributed action handler with phase=mounting when receiving cached value, and phase=mounted for subsequent dispatches", async () => {
    const capturedPhases: Phase[] = [];

    type CounterModel = { count: number };
    const counterModel: CounterModel = { count: 0 };

    function ProducerComponent({ onShowLate }: { onShowLate: () => void }) {
      const actions = useActions<CounterModel, typeof DistributedActions>(
        counterModel,
      );

      actions.useAction(DistributedActions.Counter, (context, payload) => {
        context.actions.produce((draft) => {
          draft.model.count = payload;
        });
      });

      return (
        <>
          {actions[1].consume(DistributedActions.Counter, () => null)}
          <button
            data-testid="dispatch"
            onClick={() => {
              actions[1].dispatch(DistributedActions.Counter, 42);
              onShowLate();
            }}
          >
            Dispatch
          </button>
          <button
            data-testid="dispatch-again"
            onClick={() => {
              actions[1].dispatch(DistributedActions.Counter, 100);
            }}
          >
            Dispatch Again
          </button>
        </>
      );
    }

    function LateComponent() {
      const actions = useActions<CounterModel, typeof DistributedActions>(
        counterModel,
      );

      actions.useAction(DistributedActions.Counter, (context, _payload) => {
        capturedPhases.push(context.phase);
      });

      return <div data-testid="late">Late Component</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <Consumer>
            <ProducerComponent onShowLate={() => setShow(true)} />
            {show && <LateComponent />}
          </Consumer>
        </Broadcaster>
      );
    }

    render(<App />);

    // Dispatch from producer and mount late component
    await act(async () => {
      screen.getByTestId("dispatch").click();
    });

    // Wait for effects to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // The first invocation (from cached value on mount) should have phase=mounting
    expect(capturedPhases[0]).toBe(Phase.Mounting);

    // Now dispatch again - this should have phase=mounted
    await act(async () => {
      screen.getByTestId("dispatch-again").click();
    });

    // Wait for effects to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // The second invocation (normal dispatch after mount) should have phase=mounted
    expect(capturedPhases[1]).toBe(Phase.Mounted);
  });
});

describe("useActions() filtered actions", () => {
  type UserModel = { lastPayload: string | null };
  const userModel: UserModel = { lastPayload: null };

  class UserActions {
    static UserUpdated = Action<string>("UserUpdated");
  }

  it("should only invoke filtered handler when matching filter is dispatched", async () => {
    const handlerCalls: { userId: number; payload: string }[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with filter for UserId: 1
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 1 }],
        (_context, payload) => {
          handlerCalls.push({ userId: 1, payload });
        },
      );

      // Subscribe with filter for UserId: 2
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 2 }],
        (_context, payload) => {
          handlerCalls.push({ userId: 2, payload });
        },
      );

      return actions;
    });

    // Dispatch with filter UserId: 1 only
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 1 }],
        "payload-1",
      );
    });

    // Only UserId: 1 handler should have been called
    expect(handlerCalls).toEqual([{ userId: 1, payload: "payload-1" }]);

    // Dispatch with filter UserId: 2 only
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 2 }],
        "payload-2",
      );
    });

    // Now UserId: 2 handler should also have been called
    expect(handlerCalls).toEqual([
      { userId: 1, payload: "payload-1" },
      { userId: 2, payload: "payload-2" },
    ]);
  });

  it("should invoke ALL handlers (plain and filtered) when plain action is dispatched", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe to plain action (receives ALL dispatches)
      actions.useAction(UserActions.UserUpdated, (_context, payload) => {
        handlerCalls.push(`plain:${payload}`);
      });

      // Subscribe with filter UserId: 1
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 1 }],
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      // Subscribe with filter UserId: 2
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 2 }],
        (_context, payload) => {
          handlerCalls.push(`user-2:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch to plain action - should invoke ALL handlers
    await act(async () => {
      result.current[1].dispatch(UserActions.UserUpdated, "broadcast");
    });

    // All handlers should have been called
    expect(handlerCalls).toContain("plain:broadcast");
    expect(handlerCalls).toContain("user-1:broadcast");
    expect(handlerCalls).toContain("user-2:broadcast");
    expect(handlerCalls.length).toBe(3);
  });

  it("should support different primitive types in filter values", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Number filter value
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 42 }],
        (_context, payload) => {
          handlerCalls.push(`number:${payload}`);
        },
      );

      // String filter value
      actions.useAction(
        [UserActions.UserUpdated, { Slug: "user-abc" }],
        (_context, payload) => {
          handlerCalls.push(`string:${payload}`);
        },
      );

      // Boolean filter value
      actions.useAction(
        [UserActions.UserUpdated, { Active: true }],
        (_context, payload) => {
          handlerCalls.push(`boolean:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch to number filter
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 42 }],
        "to-number",
      );
    });

    expect(handlerCalls).toEqual(["number:to-number"]);

    // Dispatch to string filter
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { Slug: "user-abc" }],
        "to-string",
      );
    });

    expect(handlerCalls).toEqual(["number:to-number", "string:to-string"]);

    // Dispatch to boolean filter
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { Active: true }],
        "to-boolean",
      );
    });

    expect(handlerCalls).toEqual([
      "number:to-number",
      "string:to-string",
      "boolean:to-boolean",
    ]);
  });

  it("should update model state via filtered action handler", async () => {
    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      actions.useAction(
        [UserActions.UserUpdated, { UserId: 1 }],
        (context, payload) => {
          context.actions.produce((draft) => {
            draft.model.lastPayload = payload;
          });
        },
      );

      return actions;
    });

    expect(result.current[0].lastPayload).toBeNull();

    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 1 }],
        "updated-value",
      );
    });

    expect(result.current[0].lastPayload).toBe("updated-value");
  });

  it("should not invoke filtered handler when different filter is dispatched", async () => {
    const handlerCalls: number[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with filter UserId: 1
      actions.useAction([UserActions.UserUpdated, { UserId: 1 }], () => {
        handlerCalls.push(1);
      });

      return actions;
    });

    // Dispatch with filter UserId: 2 (not subscribed)
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 2 }],
        "payload",
      );
    });

    // UserId: 1 handler should NOT have been called
    expect(handlerCalls).toEqual([]);
  });

  it("should support multi-property filters", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with filter {Role: "admin", UserId: 5}
      actions.useAction(
        [UserActions.UserUpdated, { Role: "admin", UserId: 5 }],
        (_context, payload) => {
          handlerCalls.push(`admin-5:${payload}`);
        },
      );

      // Subscribe with filter {Role: "admin", UserId: 10}
      actions.useAction(
        [UserActions.UserUpdated, { Role: "admin", UserId: 10 }],
        (_context, payload) => {
          handlerCalls.push(`admin-10:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch with exact match
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { Role: "admin", UserId: 5 }],
        "specific",
      );
    });

    // Only the {Role: "admin", UserId: 5} handler should have been called
    expect(handlerCalls).toEqual(["admin-5:specific"]);
  });

  it("should match handlers when dispatch filter is subset of registered filter", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with filter {Role: "admin"} - should fire for all admin dispatches
      actions.useAction(
        [UserActions.UserUpdated, { Role: "admin" }],
        (_context, payload) => {
          handlerCalls.push(`admin:${payload}`);
        },
      );

      // Subscribe with filter {Role: "admin", UserId: 5}
      actions.useAction(
        [UserActions.UserUpdated, { Role: "admin", UserId: 5 }],
        (_context, payload) => {
          handlerCalls.push(`admin-5:${payload}`);
        },
      );

      // Subscribe with filter {Role: "admin", UserId: 10}
      actions.useAction(
        [UserActions.UserUpdated, { Role: "admin", UserId: 10 }],
        (_context, payload) => {
          handlerCalls.push(`admin-10:${payload}`);
        },
      );

      // Subscribe with filter {Role: "user", UserId: 1} - should NOT fire for admin dispatches
      actions.useAction(
        [UserActions.UserUpdated, { Role: "user", UserId: 1 }],
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch with {Role: "admin"} - should match all admin handlers
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { Role: "admin" }],
        "fanout",
      );
    });

    // All admin handlers should have been called, but not user handler
    expect(handlerCalls).toContain("admin:fanout");
    expect(handlerCalls).toContain("admin-5:fanout");
    expect(handlerCalls).toContain("admin-10:fanout");
    expect(handlerCalls).not.toContain("user-1:fanout");
    expect(handlerCalls.length).toBe(3);
  });

  it("should fire all handlers when dispatching plain action with filtered subscriptions", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Plain action handler
      actions.useAction(UserActions.UserUpdated, (_context, payload) => {
        handlerCalls.push(`plain:${payload}`);
      });

      // Filtered handlers
      actions.useAction(
        [UserActions.UserUpdated, { Role: "admin", UserId: 5 }],
        (_context, payload) => {
          handlerCalls.push(`admin-5:${payload}`);
        },
      );

      actions.useAction(
        [UserActions.UserUpdated, { Role: "user", UserId: 1 }],
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch plain action - should fire ALL handlers
    await act(async () => {
      result.current[1].dispatch(UserActions.UserUpdated, "broadcast");
    });

    expect(handlerCalls).toContain("plain:broadcast");
    expect(handlerCalls).toContain("admin-5:broadcast");
    expect(handlerCalls).toContain("user-1:broadcast");
    expect(handlerCalls.length).toBe(3);
  });

  it("should match all filtered handlers when dispatching with empty filter", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with filter UserId: 1
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 1 }],
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      // Subscribe with filter UserId: 2
      actions.useAction(
        [UserActions.UserUpdated, { UserId: 2 }],
        (_context, payload) => {
          handlerCalls.push(`user-2:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch with empty filter {} - should match ALL filtered handlers
    await act(async () => {
      result.current[1].dispatch([UserActions.UserUpdated, {}], "to-all");
    });

    expect(handlerCalls).toContain("user-1:to-all");
    expect(handlerCalls).toContain("user-2:to-all");
    expect(handlerCalls.length).toBe(2);
  });

  it("should use reactive filter values when props change", async () => {
    const handlerCalls: { userId: number; payload: string }[] = [];
    let currentUserId = 5;

    const { result, rerender } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      actions.useAction(
        [UserActions.UserUpdated, { UserId: currentUserId }],
        (_context, payload) => {
          handlerCalls.push({ userId: currentUserId, payload });
        },
      );

      return actions;
    });

    // Dispatch with UserId: 5 - should match
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 5 }],
        "first",
      );
    });

    expect(handlerCalls).toEqual([{ userId: 5, payload: "first" }]);

    // Change the filter value and rerender
    currentUserId = 10;
    rerender();

    // Dispatch with UserId: 5 - should NOT match anymore
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 5 }],
        "second",
      );
    });

    // Should still be just the first call
    expect(handlerCalls.length).toBe(1);

    // Dispatch with UserId: 10 - should match now
    await act(async () => {
      result.current[1].dispatch(
        [UserActions.UserUpdated, { UserId: 10 }],
        "third",
      );
    });

    expect(handlerCalls).toEqual([
      { userId: 5, payload: "first" },
      { userId: 10, payload: "third" },
    ]);
  });
});
