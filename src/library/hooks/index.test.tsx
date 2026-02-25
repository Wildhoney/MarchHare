import { describe, expect, it } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { useActions } from "./index.ts";
import { Action } from "../action/index.ts";
import { Lifecycle, Distribution, Phase, Feature } from "../types/index.ts";
import { Broadcaster } from "../boundary/components/broadcast/index.tsx";
import { Scope } from "../boundary/components/scope/index.tsx";
import { annotate } from "../annotate/index.ts";
import { Operation } from "immertation";
import * as React from "react";

type Model = { value: string | null };

class Actions {
  static Update = Action<string>("Update");
}

class BroadcastActions {
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

describe("useActions() broadcast action mount behaviour", () => {
  it("should invoke broadcast action handler with cached value on mount", async () => {
    const capturedPayloads: number[] = [];

    type CounterModel = { count: number };
    const counterModel: CounterModel = { count: 0 };

    function ProducerComponent({ onShowLate }: { onShowLate: () => void }) {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (context, payload) => {
        context.actions.produce((draft) => {
          draft.model.count = payload;
        });
      });

      return (
        <button
          data-testid="dispatch"
          onClick={() => {
            actions[1].dispatch(BroadcastActions.Counter, 42);
            onShowLate();
          }}
        >
          Dispatch
        </button>
      );
    }

    function LateComponent() {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (_context, payload) => {
        capturedPayloads.push(payload);
      });

      return <div data-testid="late">Late Component</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <ProducerComponent onShowLate={() => setShow(true)} />
          {show && <LateComponent />}
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

  it("should invoke broadcast action handler with phase=mounting when receiving cached value, and phase=mounted for subsequent dispatches", async () => {
    const capturedPhases: Phase[] = [];

    type CounterModel = { count: number };
    const counterModel: CounterModel = { count: 0 };

    function ProducerComponent({ onShowLate }: { onShowLate: () => void }) {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (context, payload) => {
        context.actions.produce((draft) => {
          draft.model.count = payload;
        });
      });

      return (
        <>
          <button
            data-testid="dispatch"
            onClick={() => {
              actions[1].dispatch(BroadcastActions.Counter, 42);
              onShowLate();
            }}
          >
            Dispatch
          </button>
          <button
            data-testid="dispatch-again"
            onClick={() => {
              actions[1].dispatch(BroadcastActions.Counter, 100);
            }}
          >
            Dispatch Again
          </button>
        </>
      );
    }

    function LateComponent() {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (context, _payload) => {
        capturedPhases.push(context.phase);
      });

      return <div data-testid="late">Late Component</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <ProducerComponent onShowLate={() => setShow(true)} />
          {show && <LateComponent />}
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

describe("useActions() broadcast replay for late-mounting components", () => {
  it("should replay broadcast value to late-mounting useAction handler even without read()", async () => {
    const capturedPayloads: number[] = [];

    type CounterModel = { count: number };
    const counterModel: CounterModel = { count: 0 };

    function ProducerComponent({ onShowLate }: { onShowLate: () => void }) {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (context, payload) => {
        context.actions.produce((draft) => {
          draft.model.count = payload;
        });
      });

      return (
        <>
          {/* No read() call — only dispatch + useAction */}
          <button
            data-testid="dispatch-no-read"
            onClick={() => {
              actions[1].dispatch(BroadcastActions.Counter, 42);
              onShowLate();
            }}
          >
            Dispatch
          </button>
        </>
      );
    }

    function LateComponent() {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (_context, payload) => {
        capturedPayloads.push(payload);
      });

      return <div data-testid="late-no-read">Late Component</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <ProducerComponent onShowLate={() => setShow(true)} />
          {show && <LateComponent />}
        </Broadcaster>
      );
    }

    render(<App />);

    // Dispatch from producer (no read) and mount late component
    await act(async () => {
      screen.getByTestId("dispatch-no-read").click();
    });

    // Wait for effects to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // The late component should have received the cached value on mount
    // even though no read() was called
    expect(capturedPayloads).toContain(42);
  });

  it("should replay the latest broadcast value when multiple dispatches occur before mount", async () => {
    const capturedPayloads: number[] = [];

    type CounterModel = { count: number };
    const counterModel: CounterModel = { count: 0 };

    function ProducerComponent({ onShowLate }: { onShowLate: () => void }) {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, () => {});

      return (
        <>
          <button
            data-testid="dispatch-first"
            onClick={() => actions[1].dispatch(BroadcastActions.Counter, 10)}
          >
            First
          </button>
          <button
            data-testid="dispatch-second"
            onClick={() => {
              actions[1].dispatch(BroadcastActions.Counter, 20);
              onShowLate();
            }}
          >
            Second
          </button>
        </>
      );
    }

    function LateComponent() {
      const actions = useActions<CounterModel, typeof BroadcastActions>(
        counterModel,
      );

      actions.useAction(BroadcastActions.Counter, (_context, payload) => {
        capturedPayloads.push(payload);
      });

      return <div data-testid="late-multi">Late</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <ProducerComponent onShowLate={() => setShow(true)} />
          {show && <LateComponent />}
        </Broadcaster>
      );
    }

    render(<App />);

    // Dispatch first value
    await act(async () => {
      screen.getByTestId("dispatch-first").click();
    });

    // Dispatch second value and mount late component
    await act(async () => {
      screen.getByTestId("dispatch-second").click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should replay the LATEST value (20), not the first (10)
    expect(capturedPayloads).toContain(20);
    expect(capturedPayloads).not.toContain(10);
  });
});

describe("useActions() broadcast replay to child rendered after parent mount handler", () => {
  it("should replay broadcast to child that mounts after parent dispatches during Lifecycle.Mount", async () => {
    const capturedPayloads: number[] = [];

    // Separate Actions classes referencing same BroadcastActions (mirrors real app)
    class ParentActions {
      static Mount = Lifecycle.Mount();
      static Broadcast = BroadcastActions;
    }

    class ChildActions {
      static Broadcast = BroadcastActions;
    }

    type ParentModel = { loading: boolean };
    type ChildModel = { count: number };

    function ParentComponent() {
      const result = useActions<ParentModel, typeof ParentActions>({
        loading: true,
      });

      result.useAction(ParentActions.Mount, async (context) => {
        // Simulate async fetch then dispatch broadcast
        await Promise.resolve();
        context.actions.dispatch(ParentActions.Broadcast.Counter, 42);
        context.actions.produce((draft) => {
          draft.model.loading = false;
        });
      });

      if (result[0].loading) return <div data-testid="loading">Loading...</div>;
      return <ChildComponent />;
    }

    function ChildComponent() {
      const result = useActions<ChildModel, typeof ChildActions>({
        count: 0,
      });

      result.useAction(ChildActions.Broadcast.Counter, (_context, payload) => {
        capturedPayloads.push(payload);
      });

      return <div data-testid="child">Child</div>;
    }

    render(<ParentComponent />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.getByTestId("child")).toBeDefined();
    expect(capturedPayloads).toContain(42);
  });
});

describe("useActions() channeled actions", () => {
  type UserModel = { lastPayload: string | null };
  const userModel: UserModel = { lastPayload: null };

  // Channel type for UserUpdated action - supports various filter properties
  type UserChannel = {
    UserId?: number;
    Role?: string;
    Slug?: string;
    Active?: boolean;
  };

  class UserActions {
    static UserUpdated = Action<string, UserChannel>("UserUpdated");
  }

  it("should only invoke channeled handler when matching channel is dispatched", async () => {
    const handlerCalls: { userId: number; payload: string }[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with channel for UserId: 1
      actions.useAction(
        UserActions.UserUpdated({ UserId: 1 }),
        (_context, payload) => {
          handlerCalls.push({ userId: 1, payload });
        },
      );

      // Subscribe with channel for UserId: 2
      actions.useAction(
        UserActions.UserUpdated({ UserId: 2 }),
        (_context, payload) => {
          handlerCalls.push({ userId: 2, payload });
        },
      );

      return actions;
    });

    // Dispatch with channel UserId: 1 only
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 1 }),
        "payload-1",
      );
    });

    // Only UserId: 1 handler should have been called
    expect(handlerCalls).toEqual([{ userId: 1, payload: "payload-1" }]);

    // Dispatch with channel UserId: 2 only
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 2 }),
        "payload-2",
      );
    });

    // Now UserId: 2 handler should also have been called
    expect(handlerCalls).toEqual([
      { userId: 1, payload: "payload-1" },
      { userId: 2, payload: "payload-2" },
    ]);
  });

  it("should invoke ALL handlers (plain and channeled) when plain action is dispatched", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe to plain action (receives ALL dispatches)
      actions.useAction(UserActions.UserUpdated, (_context, payload) => {
        handlerCalls.push(`plain:${payload}`);
      });

      // Subscribe with channel UserId: 1
      actions.useAction(
        UserActions.UserUpdated({ UserId: 1 }),
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      // Subscribe with channel UserId: 2
      actions.useAction(
        UserActions.UserUpdated({ UserId: 2 }),
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

  it("should support different primitive types in channel values", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Number channel value
      actions.useAction(
        UserActions.UserUpdated({ UserId: 42 }),
        (_context, payload) => {
          handlerCalls.push(`number:${payload}`);
        },
      );

      // String channel value
      actions.useAction(
        UserActions.UserUpdated({ Slug: "user-abc" }),
        (_context, payload) => {
          handlerCalls.push(`string:${payload}`);
        },
      );

      // Boolean channel value
      actions.useAction(
        UserActions.UserUpdated({ Active: true }),
        (_context, payload) => {
          handlerCalls.push(`boolean:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch to number channel
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 42 }),
        "to-number",
      );
    });

    expect(handlerCalls).toEqual(["number:to-number"]);

    // Dispatch to string channel
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ Slug: "user-abc" }),
        "to-string",
      );
    });

    expect(handlerCalls).toEqual(["number:to-number", "string:to-string"]);

    // Dispatch to boolean channel
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ Active: true }),
        "to-boolean",
      );
    });

    expect(handlerCalls).toEqual([
      "number:to-number",
      "string:to-string",
      "boolean:to-boolean",
    ]);
  });

  it("should update model state via channeled action handler", async () => {
    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      actions.useAction(
        UserActions.UserUpdated({ UserId: 1 }),
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
        UserActions.UserUpdated({ UserId: 1 }),
        "updated-value",
      );
    });

    expect(result.current[0].lastPayload).toBe("updated-value");
  });

  it("should not invoke channeled handler when different channel is dispatched", async () => {
    const handlerCalls: number[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with channel UserId: 1
      actions.useAction(UserActions.UserUpdated({ UserId: 1 }), () => {
        handlerCalls.push(1);
      });

      return actions;
    });

    // Dispatch with channel UserId: 2 (not subscribed)
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 2 }),
        "payload",
      );
    });

    // UserId: 1 handler should NOT have been called
    expect(handlerCalls).toEqual([]);
  });

  it("should support multi-property channels", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with channel {Role: "admin", UserId: 5}
      actions.useAction(
        UserActions.UserUpdated({ Role: "admin", UserId: 5 }),
        (_context, payload) => {
          handlerCalls.push(`admin-5:${payload}`);
        },
      );

      // Subscribe with channel {Role: "admin", UserId: 10}
      actions.useAction(
        UserActions.UserUpdated({ Role: "admin", UserId: 10 }),
        (_context, payload) => {
          handlerCalls.push(`admin-10:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch with exact match
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ Role: "admin", UserId: 5 }),
        "specific",
      );
    });

    // Only the {Role: "admin", UserId: 5} handler should have been called
    expect(handlerCalls).toEqual(["admin-5:specific"]);
  });

  it("should match handlers when dispatch channel is subset of registered channel", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with channel {Role: "admin"} - should fire for all admin dispatches
      actions.useAction(
        UserActions.UserUpdated({ Role: "admin" }),
        (_context, payload) => {
          handlerCalls.push(`admin:${payload}`);
        },
      );

      // Subscribe with channel {Role: "admin", UserId: 5}
      actions.useAction(
        UserActions.UserUpdated({ Role: "admin", UserId: 5 }),
        (_context, payload) => {
          handlerCalls.push(`admin-5:${payload}`);
        },
      );

      // Subscribe with channel {Role: "admin", UserId: 10}
      actions.useAction(
        UserActions.UserUpdated({ Role: "admin", UserId: 10 }),
        (_context, payload) => {
          handlerCalls.push(`admin-10:${payload}`);
        },
      );

      // Subscribe with channel {Role: "user", UserId: 1} - should NOT fire for admin dispatches
      actions.useAction(
        UserActions.UserUpdated({ Role: "user", UserId: 1 }),
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch with {Role: "admin"} - should match all admin handlers
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ Role: "admin" }),
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

  it("should fire all handlers when dispatching plain action with channeled subscriptions", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Plain action handler
      actions.useAction(UserActions.UserUpdated, (_context, payload) => {
        handlerCalls.push(`plain:${payload}`);
      });

      // Channeled handlers
      actions.useAction(
        UserActions.UserUpdated({ Role: "admin", UserId: 5 }),
        (_context, payload) => {
          handlerCalls.push(`admin-5:${payload}`);
        },
      );

      actions.useAction(
        UserActions.UserUpdated({ Role: "user", UserId: 1 }),
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

  it("should match all channeled handlers when dispatching with empty channel", async () => {
    const handlerCalls: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      // Subscribe with channel UserId: 1
      actions.useAction(
        UserActions.UserUpdated({ UserId: 1 }),
        (_context, payload) => {
          handlerCalls.push(`user-1:${payload}`);
        },
      );

      // Subscribe with channel UserId: 2
      actions.useAction(
        UserActions.UserUpdated({ UserId: 2 }),
        (_context, payload) => {
          handlerCalls.push(`user-2:${payload}`);
        },
      );

      return actions;
    });

    // Dispatch with empty channel {} - should match ALL channeled handlers
    await act(async () => {
      result.current[1].dispatch(UserActions.UserUpdated({}), "to-all");
    });

    expect(handlerCalls).toContain("user-1:to-all");
    expect(handlerCalls).toContain("user-2:to-all");
    expect(handlerCalls.length).toBe(2);
  });

  it("should use reactive channel values when props change", async () => {
    const handlerCalls: { userId: number; payload: string }[] = [];
    let currentUserId = 5;

    const { result, rerender } = renderHook(() => {
      const actions = useActions<UserModel, typeof UserActions>(userModel);

      actions.useAction(
        UserActions.UserUpdated({ UserId: currentUserId }),
        (_context, payload) => {
          handlerCalls.push({ userId: currentUserId, payload });
        },
      );

      return actions;
    });

    // Dispatch with UserId: 5 - should match
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 5 }),
        "first",
      );
    });

    expect(handlerCalls).toEqual([{ userId: 5, payload: "first" }]);

    // Change the channel value and rerender
    currentUserId = 10;
    rerender();

    // Dispatch with UserId: 5 - should NOT match anymore
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 5 }),
        "second",
      );
    });

    // Should still be just the first call
    expect(handlerCalls.length).toBe(1);

    // Dispatch with UserId: 10 - should match now
    await act(async () => {
      result.current[1].dispatch(
        UserActions.UserUpdated({ UserId: 10 }),
        "third",
      );
    });

    expect(handlerCalls).toEqual([
      { userId: 5, payload: "first" },
      { userId: 10, payload: "third" },
    ]);
  });
});

describe("useActions() StrictMode resilience", () => {
  type CountModel = { count: number };
  const countModel: CountModel = { count: 0 };

  class CountActions {
    static Mount = Lifecycle.Mount();
    static Increment = Action("Increment");
  }

  const _StrictWrapper = ({ children }: { children: React.ReactNode }) => (
    <React.StrictMode>{children}</React.StrictMode>
  );

  it("should emit Lifecycle.Mount exactly once in StrictMode", async () => {
    let mountCount = 0;

    function TestComponent() {
      const actions = useActions<CountModel, typeof CountActions>(countModel);

      actions.useAction(CountActions.Mount, () => {
        mountCount++;
      });

      return <div data-testid="mounted">mounted</div>;
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mountCount).toBe(1);
  });

  it("should invoke each action handler exactly once per dispatch in StrictMode", async () => {
    let handlerCount = 0;

    function TestComponent() {
      const actions = useActions<CountModel, typeof CountActions>(countModel);

      actions.useAction(CountActions.Increment, () => {
        handlerCount++;
      });

      return (
        <button
          data-testid="dispatch"
          onClick={() => actions[1].dispatch(CountActions.Increment)}
        >
          Dispatch
        </button>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    handlerCount = 0;

    await act(async () => {
      screen.getByTestId("dispatch").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(handlerCount).toBe(1);
  });

  it("should clear annotations after produce in StrictMode", async () => {
    type AnnotatedModel = { name: string | null };

    const SetName = Action<string>("SetName");
    class AnnotatedActions {
      static SetName = SetName;
    }

    function TestComponent() {
      const result = useActions<AnnotatedModel, typeof AnnotatedActions>({
        name: annotate(Operation.Update, null),
      });

      result.useAction(AnnotatedActions.SetName, (context, name) => {
        context.actions.produce(({ model }) => {
          model.name = name;
        });
      });

      return (
        <>
          <span data-testid="pending">
            {String(result[1].inspect.name.pending())}
          </span>
          <span data-testid="value">{result[0].name ?? "null"}</span>
          <button
            data-testid="set"
            onClick={() => result[1].dispatch(AnnotatedActions.SetName, "Adam")}
          >
            Set
          </button>
        </>
      );
    }

    render(
      <React.StrictMode>
        <TestComponent />
      </React.StrictMode>,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId("pending").textContent).toBe("true");

    await act(async () => {
      screen.getByTestId("set").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId("value").textContent).toBe("Adam");
    expect(screen.getByTestId("pending").textContent).toBe("false");
  });

  it("should not double-register Mount handlers causing duplicate API calls in StrictMode", async () => {
    const apiCalls: string[] = [];

    function ParentComponent() {
      const actions = useActions<CountModel, typeof CountActions>(countModel);

      actions.useAction(CountActions.Mount, () => {
        apiCalls.push("parent-mount");
      });

      return <ChildComponent />;
    }

    function ChildComponent() {
      const actions = useActions<CountModel, typeof CountActions>(countModel);

      actions.useAction(CountActions.Mount, () => {
        apiCalls.push("child-mount");
      });

      return <div data-testid="child">child</div>;
    }

    render(
      <React.StrictMode>
        <ParentComponent />
      </React.StrictMode>,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(apiCalls.filter((c) => c === "parent-mount")).toHaveLength(1);
    expect(apiCalls.filter((c) => c === "child-mount")).toHaveLength(1);
  });
});

describe("useActions() context.actions.read", () => {
  class BroadcastReadActions {
    static Name = Action<string>("Name", Distribution.Broadcast);
  }

  class MulticastReadActions {
    static Score = Action<number>("Score", Distribution.Multicast);
  }

  it("should return the cached value from the broadcast emitter", async () => {
    let readValue: string | null = null;

    type M = { result: string | null };

    function Publisher() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastReadActions
      >({});

      return (
        <button
          data-testid="publish"
          onClick={() => actions.dispatch(BroadcastReadActions.Name, "Adam")}
        >
          Publish
        </button>
      );
    }

    function Reader() {
      const result = useActions<M, typeof BroadcastReadActions>({
        result: null,
      });

      result.useAction(BroadcastReadActions.Name, async (context, _name) => {
        const value = await context.actions.read(BroadcastReadActions.Name);
        readValue = value;
        context.actions.produce(({ model }) => {
          model.result = value;
        });
      });

      return <div data-testid="result">{result[0].result ?? "null"}</div>;
    }

    function App() {
      return (
        <Broadcaster>
          <Publisher />
          <Reader />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("publish").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(readValue).toBe("Adam");
  });

  it("should return null when no value has been dispatched", async () => {
    let readValue: unknown = "not-called";

    class LocalActions {
      static Trigger = Action("Trigger");
    }

    function Reader() {
      const result = useActions<Record<string, never>, typeof LocalActions>({});

      result.useAction(LocalActions.Trigger, async (context) => {
        const value = await context.actions.read(BroadcastReadActions.Name);
        readValue = value;
      });

      return (
        <button
          data-testid="trigger"
          onClick={() => result[1].dispatch(LocalActions.Trigger)}
        >
          Trigger
        </button>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Reader />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("trigger").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(readValue).toBeNull();
  });

  it("should return multicast value from the scope cache", async () => {
    let readValue: number | null = null;

    function Publisher() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof MulticastReadActions
      >({});

      return (
        <button
          data-testid="publish-mc"
          onClick={() =>
            actions.dispatch(MulticastReadActions.Score, 99, {
              scope: "test",
            })
          }
        >
          Publish
        </button>
      );
    }

    function Reader() {
      const result = useActions<
        Record<string, never>,
        typeof MulticastReadActions
      >({});

      result.useAction(MulticastReadActions.Score, async (context) => {
        const value = await context.actions.read(MulticastReadActions.Score, {
          scope: "test",
        });
        readValue = value;
      });

      return <div data-testid="mc-reader">Reader</div>;
    }

    function App() {
      return (
        <Broadcaster>
          <Scope name="test">
            <Publisher />
            <Reader />
          </Scope>
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("publish-mc").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(readValue).toBe(99);
  });

  it("should wait for settled annotations before resolving", async () => {
    let readValue: string | null = null;

    type M = { name: string | null };

    class LocalActions {
      static Read = Action("Read");
    }

    function Publisher() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastReadActions
      >({});

      return (
        <button
          data-testid="publish-settle"
          onClick={() =>
            actions.dispatch(BroadcastReadActions.Name, "settled-value")
          }
        >
          Publish
        </button>
      );
    }

    function Reader() {
      const actions = useActions<M, typeof BroadcastReadActions>({
        name: null,
      });

      // Handle the broadcast: annotate twice then settle after async work.
      actions.useAction(BroadcastReadActions.Name, async (context, name) => {
        // Annotate twice to simulate multiple pending ops.
        context.actions.produce(({ model, inspect }) => {
          model.name = inspect.annotate(Operation.Update, name);
        });
        context.actions.produce(({ model, inspect }) => {
          model.name = inspect.annotate(Operation.Update, name);
        });

        // Settle after async work.
        await new Promise((r) => setTimeout(r, 50));
        context.actions.produce(({ model }) => {
          model.name = "settled-value";
        });

        await new Promise((r) => setTimeout(r, 50));
        context.actions.produce(({ model }) => {
          model.name = "settled-value";
        });
      });

      // Read should await until the annotations on `name` have settled.
      actions.useAction(LocalActions.Read, async (context) => {
        const value = await context.actions.read(BroadcastReadActions.Name);
        readValue = value;
      });

      return (
        <button
          data-testid="trigger-read"
          onClick={() => actions[1].dispatch(LocalActions.Read)}
        >
          Read
        </button>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Publisher />
          <Reader />
        </Broadcaster>
      );
    }

    render(<App />);

    // Publish the broadcast value, which triggers annotations.
    await act(async () => {
      screen.getByTestId("publish-settle").click();
    });

    // Trigger read while annotations are still pending.
    await act(async () => {
      screen.getByTestId("trigger-read").click();
    });

    // Allow time for annotations to settle.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(readValue).toBe("settled-value");
  });
});

describe("useActions() context.actions.peek", () => {
  class BroadcastPeekActions {
    static Name = Action<string>("Name", Distribution.Broadcast);
  }

  it("should return the cached value synchronously", async () => {
    let peekedValue: string | null = null;

    class LocalActions {
      static Check = Action("Check");
    }

    function Publisher() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastPeekActions
      >({});

      return (
        <button
          data-testid="publish-peek"
          onClick={() =>
            actions.dispatch(BroadcastPeekActions.Name, "Wildhoney")
          }
        >
          Publish
        </button>
      );
    }

    function Reader() {
      const result = useActions<Record<string, never>, typeof LocalActions>({});

      result.useAction(LocalActions.Check, (context) => {
        peekedValue = context.actions.peek(BroadcastPeekActions.Name);
      });

      return (
        <button
          data-testid="peek"
          onClick={() => result[1].dispatch(LocalActions.Check)}
        >
          Peek
        </button>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Publisher />
          <Reader />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("publish-peek").click();
    });

    await act(async () => {
      screen.getByTestId("peek").click();
    });

    expect(peekedValue).toBe("Wildhoney");
  });

  it("should return null when no value has been dispatched", async () => {
    let peekedValue: unknown = "not-called";

    class LocalActions {
      static Check = Action("Check");
    }

    function Reader() {
      const result = useActions<Record<string, never>, typeof LocalActions>({});

      result.useAction(LocalActions.Check, (context) => {
        peekedValue = context.actions.peek(BroadcastPeekActions.Name);
      });

      return (
        <button
          data-testid="peek-empty"
          onClick={() => result[1].dispatch(LocalActions.Check)}
        >
          Peek
        </button>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Reader />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("peek-empty").click();
    });

    expect(peekedValue).toBeNull();
  });
});

describe("useActions() context.model freshness", () => {
  type ItemModel = { items: string[] };
  const itemModel: ItemModel = { items: [] };

  class ItemActions {
    static Add = Action<string>("Add");
    static Process = Action("Process");
  }

  it("should provide the latest model in context after a prior action mutates state", async () => {
    let capturedItems: string[] = [];

    const { result } = renderHook(() => {
      const actions = useActions<ItemModel, typeof ItemActions>(itemModel);

      actions.useAction(ItemActions.Add, (context, item) => {
        context.actions.produce((draft) => {
          draft.model.items = [...draft.model.items, item];
        });
      });

      actions.useAction(ItemActions.Process, (context) => {
        capturedItems = [...context.model.items];
      });

      return actions;
    });

    // Add items first
    await act(async () => {
      result.current[1].dispatch(ItemActions.Add, "file-1");
    });

    await act(async () => {
      result.current[1].dispatch(ItemActions.Add, "file-2");
    });

    // Process should see both items via context.model
    await act(async () => {
      result.current[1].dispatch(ItemActions.Process);
    });

    expect(capturedItems).toEqual(["file-1", "file-2"]);
  });
});

describe("useActions() void actions", () => {
  const Mount = Lifecycle.Mount();

  it("should work with void model and void actions using bare useActions()", async () => {
    let mounted = false;

    renderHook(() => {
      const actions = useActions();

      actions.useAction(Mount, () => {
        mounted = true;
      });

      return actions;
    });

    expect(mounted).toBe(true);
  });

  it("should work with explicit void, void type parameters", async () => {
    let mounted = false;

    renderHook(() => {
      const actions = useActions<void, void>();

      actions.useAction(Mount, () => {
        mounted = true;
      });

      return actions;
    });

    expect(mounted).toBe(true);
  });

  it("should work with model and void actions", async () => {
    type LocalModel = { count: number };

    const { result } = renderHook(() => {
      const actions = useActions<LocalModel, void>({ count: 0 });

      actions.useAction(Mount, (context) => {
        context.actions.produce(({ model }) => {
          model.count = 42;
        });
      });

      return actions;
    });

    expect(result.current[0].count).toBe(42);
  });

  it("should support context.data with void actions", async () => {
    let capturedQuery: string | null = null;

    const { result } = renderHook(() => {
      const actions = useActions<void, void, { query: string }>(() => ({
        query: "test",
      }));

      actions.useAction(Mount, (context) => {
        capturedQuery = context.data.query;
      });

      return actions;
    });

    void result;
    expect(capturedQuery).toBe("test");
  });
});

describe("useActions() void model", () => {
  class VoidActions {
    static Mount = Lifecycle.Mount();
    static Ping = Action("Ping");
    static SetValue = Action<string>("SetValue");
  }

  it("should work without a model", async () => {
    let pinged = false;

    const { result } = renderHook(() => {
      const actions = useActions<void, typeof VoidActions>();

      actions.useAction(VoidActions.Ping, () => {
        pinged = true;
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(VoidActions.Ping);
    });

    expect(pinged).toBe(true);
  });

  it("should receive payloads in handlers", async () => {
    let captured: string | null = null;

    const { result } = renderHook(() => {
      const actions = useActions<void, typeof VoidActions>();

      actions.useAction(VoidActions.SetValue, (_context, value) => {
        captured = value;
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(VoidActions.SetValue, "hello");
    });

    expect(captured).toBe("hello");
  });

  it("should support lifecycle actions", async () => {
    let mounted = false;

    renderHook(() => {
      const actions = useActions<void, typeof VoidActions>();

      actions.useAction(VoidActions.Mount, () => {
        mounted = true;
      });

      return actions;
    });

    expect(mounted).toBe(true);
  });

  it("should support context.data with void model", async () => {
    let capturedQuery: string | null = null;

    const { result } = renderHook(() => {
      const actions = useActions<void, typeof VoidActions, { query: string }>(
        () => ({ query: "search-term" }),
      );

      actions.useAction(VoidActions.Ping, (context) => {
        capturedQuery = context.data.query;
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(VoidActions.Ping);
    });

    expect(capturedQuery).toBe("search-term");
  });

  it("should dispatch broadcast actions with void model", async () => {
    let received = false;

    class BroadcastVoidActions {
      static Notify = Action("Notify", Distribution.Broadcast);
    }

    function Sender() {
      const actions = useActions<void, typeof BroadcastVoidActions>();

      actions.useAction(BroadcastVoidActions.Notify, () => {});

      return (
        <button
          data-testid="send"
          onClick={() => actions[1].dispatch(BroadcastVoidActions.Notify)}
        >
          Send
        </button>
      );
    }

    function Receiver() {
      const actions = useActions<void, typeof BroadcastVoidActions>();

      actions.useAction(BroadcastVoidActions.Notify, () => {
        received = true;
      });

      return <div>Receiver</div>;
    }

    function App() {
      return (
        <Broadcaster>
          <Sender />
          <Receiver />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("send").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(received).toBe(true);
  });
});

describe("useActions() actions.stream (JSX)", () => {
  class BroadcastUserActions {
    static User = Action<{ name: string; id: number }>(
      "User",
      Distribution.Broadcast,
    );
  }

  it("should render broadcast values declaratively in JSX", async () => {
    function Publisher() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUserActions
      >({});

      return (
        <button
          data-testid="jsx-stream-publish"
          onClick={() =>
            actions.dispatch(BroadcastUserActions.User, {
              name: "Diana",
              id: 4,
            })
          }
        >
          Publish
        </button>
      );
    }

    function Consumer() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUserActions
      >({});

      return (
        <div data-testid="jsx-stream-container">
          {actions.stream(BroadcastUserActions.User, (user) => (
            <span data-testid="jsx-stream-value">{user.name}</span>
          ))}
        </div>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Publisher />
          <Consumer />
        </Broadcaster>
      );
    }

    render(<App />);

    // Before dispatch, no value rendered
    expect(screen.queryByTestId("jsx-stream-value")).toBeNull();

    await act(async () => {
      screen.getByTestId("jsx-stream-publish").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId("jsx-stream-value").textContent).toBe("Diana");
  });

  it("should return null until first dispatch", async () => {
    // Use a unique action to avoid cached values from previous tests
    class NeverDispatchedActions {
      static Info = Action<{ label: string }>(
        "NeverDispatched",
        Distribution.Broadcast,
      );
    }

    function Consumer() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof NeverDispatchedActions
      >({});

      return (
        <div data-testid="jsx-stream-empty">
          {actions.stream(NeverDispatchedActions.Info, (info) => (
            <span data-testid="jsx-stream-present">{info.label}</span>
          ))}
        </div>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Consumer />
        </Broadcaster>
      );
    }

    render(<App />);

    // Should not render anything inside the container
    expect(screen.queryByTestId("jsx-stream-present")).toBeNull();
    expect(screen.getByTestId("jsx-stream-empty").textContent).toBe("");
  });

  it("should update when a new value is dispatched", async () => {
    function Publisher() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUserActions
      >({});

      return (
        <>
          <button
            data-testid="jsx-stream-publish-1"
            onClick={() =>
              actions.dispatch(BroadcastUserActions.User, {
                name: "Alice",
                id: 1,
              })
            }
          >
            Publish Alice
          </button>
          <button
            data-testid="jsx-stream-publish-2"
            onClick={() =>
              actions.dispatch(BroadcastUserActions.User, {
                name: "Bob",
                id: 2,
              })
            }
          >
            Publish Bob
          </button>
        </>
      );
    }

    function Consumer() {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUserActions
      >({});

      return (
        <div>
          {actions.stream(BroadcastUserActions.User, (user) => (
            <span data-testid="jsx-stream-updated">{user.name}</span>
          ))}
        </div>
      );
    }

    function App() {
      return (
        <Broadcaster>
          <Publisher />
          <Consumer />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("jsx-stream-publish-1").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId("jsx-stream-updated").textContent).toBe("Alice");

    await act(async () => {
      screen.getByTestId("jsx-stream-publish-2").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId("jsx-stream-updated").textContent).toBe("Bob");
  });
});

describe("useActions() mount + broadcast replay deduplication", () => {
  class BroadcastUser {
    static Mount = Lifecycle.Mount();
    static User = Action<{ id: number }>("User", Distribution.Broadcast);
  }

  it("should fire both Lifecycle.Mount and cached broadcast replay, causing duplicate work without guards", async () => {
    const calls: string[] = [];

    function Producer({ onShowLate }: { onShowLate: () => void }) {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUser
      >({});

      return (
        <button
          data-testid="dispatch-user"
          onClick={() => {
            actions.dispatch(BroadcastUser.User, { id: 1 });
            onShowLate();
          }}
        >
          Dispatch
        </button>
      );
    }

    function Late() {
      const actions = useActions<{ loaded: boolean }, typeof BroadcastUser>({
        loaded: false,
      });

      actions.useAction(BroadcastUser.Mount, () => {
        calls.push("mount");
      });

      actions.useAction(BroadcastUser.User, () => {
        calls.push("broadcast");
      });

      return <div data-testid="late-dedup">Late</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <Producer onShowLate={() => setShow(true)} />
          {show && <Late />}
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("dispatch-user").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Both handlers fire during mount — this is the problem scenario
    expect(calls).toContain("mount");
    expect(calls).toContain("broadcast");
    expect(calls).toHaveLength(2);
  });

  it("should avoid duplicate work by using peek() in Lifecycle.Mount to detect existing broadcast value", async () => {
    const fetches: string[] = [];

    function Producer({ onShowLate }: { onShowLate: () => void }) {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUser
      >({});

      return (
        <button
          data-testid="dispatch-peek-guard"
          onClick={() => {
            actions.dispatch(BroadcastUser.User, { id: 1 });
            onShowLate();
          }}
        >
          Dispatch
        </button>
      );
    }

    function Late() {
      const actions = useActions<{ loaded: boolean }, typeof BroadcastUser>({
        loaded: false,
      });

      // Guard: only fetch in mount if no broadcast value is cached
      actions.useAction(BroadcastUser.Mount, (context) => {
        const user = context.actions.peek(BroadcastUser.User);
        if (!user) fetches.push("mount-fetch");
      });

      // Always fetch on broadcast (including cached replay)
      actions.useAction(BroadcastUser.User, (_context, user) => {
        fetches.push(`broadcast-fetch:${user.id}`);
      });

      return <div data-testid="late-peek">Late</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <Producer onShowLate={() => setShow(true)} />
          {show && <Late />}
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("dispatch-peek-guard").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Mount handler skipped (peek found cached value), only broadcast fires
    expect(fetches).toEqual(["broadcast-fetch:1"]);
  });

  it("should avoid duplicate work by checking context.phase in the broadcast handler", async () => {
    const fetches: string[] = [];

    function Producer({ onShowLate }: { onShowLate: () => void }) {
      const [, actions] = useActions<
        Record<string, never>,
        typeof BroadcastUser
      >({});

      return (
        <>
          <button
            data-testid="dispatch-phase-guard"
            onClick={() => {
              actions.dispatch(BroadcastUser.User, { id: 1 });
              onShowLate();
            }}
          >
            Dispatch
          </button>
          <button
            data-testid="dispatch-phase-again"
            onClick={() => {
              actions.dispatch(BroadcastUser.User, { id: 2 });
            }}
          >
            Dispatch Again
          </button>
        </>
      );
    }

    function Late() {
      const actions = useActions<{ loaded: boolean }, typeof BroadcastUser>({
        loaded: false,
      });

      // Mount always fetches
      actions.useAction(BroadcastUser.Mount, () => {
        fetches.push("mount-fetch");
      });

      // Broadcast skips cached replay (phase=Mounting), only handles live dispatches
      actions.useAction(BroadcastUser.User, (context, user) => {
        if (context.phase === Phase.Mounting) return;
        fetches.push(`broadcast-fetch:${user.id}`);
      });

      return <div data-testid="late-phase">Late</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <Producer onShowLate={() => setShow(true)} />
          {show && <Late />}
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("dispatch-phase-guard").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Only mount fetch ran; cached broadcast replay was skipped
    expect(fetches).toEqual(["mount-fetch"]);

    // Subsequent live dispatch should still work
    await act(async () => {
      screen.getByTestId("dispatch-phase-again").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fetches).toEqual(["mount-fetch", "broadcast-fetch:2"]);
  });

  it("should fetch in Lifecycle.Mount when no broadcast value is cached", async () => {
    const fetches: string[] = [];

    function Late() {
      const actions = useActions<{ loaded: boolean }, typeof BroadcastUser>({
        loaded: false,
      });

      // Guard: only fetch in mount if no broadcast value is cached
      actions.useAction(BroadcastUser.Mount, (context) => {
        const user = context.actions.peek(BroadcastUser.User);
        if (!user) fetches.push("mount-fetch");
      });

      actions.useAction(BroadcastUser.User, (_context, user) => {
        fetches.push(`broadcast-fetch:${user.id}`);
      });

      return <div>Late</div>;
    }

    function App() {
      return (
        <Broadcaster>
          <Late />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // No cached broadcast, so mount handler fetches
    expect(fetches).toEqual(["mount-fetch"]);
  });

  it("should deduplicate with multicast actions using peek() and scope", async () => {
    class MulticastUser {
      static Mount = Lifecycle.Mount();
      static User = Action<{ id: number }>("User", Distribution.Multicast);
    }

    const fetches: string[] = [];

    function Producer({ onShowLate }: { onShowLate: () => void }) {
      const [, actions] = useActions<
        Record<string, never>,
        typeof MulticastUser
      >({});

      return (
        <button
          data-testid="dispatch-mc-dedup"
          onClick={() => {
            actions.dispatch(MulticastUser.User, { id: 3 }, { scope: "team" });
            onShowLate();
          }}
        >
          Dispatch
        </button>
      );
    }

    function Late() {
      const actions = useActions<{ loaded: boolean }, typeof MulticastUser>({
        loaded: false,
      });

      actions.useAction(MulticastUser.Mount, (context) => {
        const user = context.actions.peek(MulticastUser.User, {
          scope: "team",
        });
        if (!user) fetches.push("mount-fetch");
      });

      actions.useAction(MulticastUser.User, (_context, user) => {
        fetches.push(`multicast-fetch:${user.id}`);
      });

      return <div>Late</div>;
    }

    function App() {
      const [show, setShow] = React.useState(false);

      return (
        <Broadcaster>
          <Scope name="team">
            <Producer onShowLate={() => setShow(true)} />
            {show && <Late />}
          </Scope>
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("dispatch-mc-dedup").click();
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Mount handler skipped (peek found cached value), only multicast fires
    expect(fetches).toEqual(["multicast-fetch:3"]);
  });
});

describe("useActions() feature toggles", () => {
  type FeatureModel = {
    count: number;
    features: { Sidebar: boolean; Modal: boolean };
  };

  class FeatureActions {
    static Mount = Lifecycle.Mount();
    static Toggle = Action<"Sidebar" | "Modal">("Toggle");
  }

  const featureModel: FeatureModel = {
    count: 0,
    features: { Sidebar: false, Modal: false },
  };

  it("should toggle a feature with Feature.Toggle", () => {
    const { result } = renderHook(() => {
      const actions = useActions<FeatureModel, typeof FeatureActions>(
        featureModel,
      );
      return actions;
    });

    act(() => {
      result.current[1].feature("Sidebar", Feature.Toggle);
    });

    expect(result.current[0].features.Sidebar).toBe(true);
  });

  it("should set a feature to true with Feature.On", () => {
    const { result } = renderHook(() => {
      const actions = useActions<FeatureModel, typeof FeatureActions>(
        featureModel,
      );
      return actions;
    });

    act(() => {
      result.current[1].feature("Modal", Feature.On);
    });

    expect(result.current[0].features.Modal).toBe(true);
  });

  it("should set a feature to false with Feature.Off", () => {
    const { result } = renderHook(() => {
      const actions = useActions<FeatureModel, typeof FeatureActions>({
        ...featureModel,
        features: { Sidebar: true, Modal: true },
      });
      return actions;
    });

    act(() => {
      result.current[1].feature("Sidebar", Feature.Off);
    });

    expect(result.current[0].features.Sidebar).toBe(false);
  });

  it("should be idempotent: Feature.On when already true stays true", () => {
    const { result } = renderHook(() => {
      const actions = useActions<FeatureModel, typeof FeatureActions>({
        ...featureModel,
        features: { Sidebar: true, Modal: false },
      });
      return actions;
    });

    act(() => {
      result.current[1].feature("Sidebar", Feature.On);
    });

    expect(result.current[0].features.Sidebar).toBe(true);
  });

  it("should support feature() in handler context", async () => {
    const { result } = renderHook(() => {
      const actions = useActions<FeatureModel, typeof FeatureActions>(
        featureModel,
      );

      actions.useAction(FeatureActions.Toggle, (context, name) => {
        context.actions.feature(name, Feature.Toggle);
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(FeatureActions.Toggle, "Sidebar");
    });

    expect(result.current[0].features.Sidebar).toBe(true);
  });
});

describe("useActions() awaitable dispatch", () => {
  it("should await broadcast handlers before proceeding", async () => {
    const executionOrder: string[] = [];

    class PaymentActions {
      static Mount = Lifecycle.Mount();
      static PaymentSent = Action("PaymentSent", Distribution.Broadcast);
    }

    type ProducerModel = { loading: boolean };

    function Producer() {
      const actions = useActions<ProducerModel, typeof PaymentActions>({
        loading: true,
      });

      actions.useAction(PaymentActions.Mount, async (context) => {
        executionOrder.push("dispatch:start");
        await context.actions.dispatch(PaymentActions.PaymentSent);
        executionOrder.push("dispatch:settled");
        context.actions.produce(({ model }) => {
          model.loading = false;
        });
        executionOrder.push("loading:false");
      });

      return (
        <div data-testid="loading">
          {actions[0].loading ? "loading" : "done"}
        </div>
      );
    }

    function Consumer() {
      const actions = useActions<void, typeof PaymentActions>();

      actions.useAction(PaymentActions.PaymentSent, async () => {
        executionOrder.push("handler:start");
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push("handler:end");
      });

      return null;
    }

    function App() {
      return (
        <Broadcaster>
          <Consumer />
          <Producer />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(executionOrder).toEqual([
      "dispatch:start",
      "handler:start",
      "handler:end",
      "dispatch:settled",
      "loading:false",
    ]);
    expect(screen.getByTestId("loading")).toHaveTextContent("done");
  });

  it("should not await generator handlers (they run in background)", async () => {
    let dispatchSettled = false;
    let generatorComplete = false;

    class StreamActions {
      static Start = Action("Start");
      static Stream = Action("Stream", Distribution.Broadcast);
    }

    function Dispatcher() {
      const actions = useActions<void, typeof StreamActions>();

      actions.useAction(StreamActions.Start, async (context) => {
        await context.actions.dispatch(StreamActions.Stream);
        dispatchSettled = true;
        // Generator should still be running at this point.
        expect(generatorComplete).toBe(false);
      });

      return (
        <button
          data-testid="start"
          onClick={() => actions[1].dispatch(StreamActions.Start)}
        >
          Start
        </button>
      );
    }

    function StreamConsumer() {
      const actions = useActions<void, typeof StreamActions>();

      actions.useAction(StreamActions.Stream, function* (_context) {
        yield;
        yield new Promise((r) => setTimeout(r, 100));
        generatorComplete = true;
      });

      return null;
    }

    function App() {
      return (
        <Broadcaster>
          <StreamConsumer />
          <Dispatcher />
        </Broadcaster>
      );
    }

    render(<App />);

    await act(async () => {
      screen.getByTestId("start").click();
    });

    expect(dispatchSettled).toBe(true);
    expect(generatorComplete).toBe(false);

    // Let the generator finish.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(generatorComplete).toBe(true);
  });
});
