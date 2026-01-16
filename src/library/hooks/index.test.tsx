import { describe, expect, it } from "@jest/globals";
import { renderHook, act, render, screen } from "@testing-library/react";
import { useActions } from "./index.ts";
import { Action } from "../action/index.ts";
import { Distribution } from "../types/index.ts";
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
});
