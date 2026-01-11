import { describe, expect, it } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useActions } from "./index.ts";
import { Action } from "../action/index.ts";

type Model = { value: string | null };

class Actions {
  static Update = Action<string>("Update");
}

const model: Model = { value: null };

describe("useActions() snapshot callback", () => {
  it("should provide snapshot values via context.snapshot", async () => {
    const capturedSnapshot: { external?: string } = {};

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof Actions, { external: string }>(
        model,
        () => ({ external: "test-value" }),
      );

      actions.useAction(Actions.Update, (context) => {
        capturedSnapshot.external = context.snapshot.external;
        context.actions.produce((draft) => {
          draft.model.value = context.snapshot.external;
        });
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    expect(capturedSnapshot.external).toBe("test-value");
    expect(result.current[0].value).toBe("test-value");
  });

  it("should provide latest snapshot values even after rerender", async () => {
    const capturedValues: string[] = [];
    let externalValue = "initial";

    const { result, rerender } = renderHook(() => {
      const actions = useActions<Model, typeof Actions, { external: string }>(
        model,
        () => ({ external: externalValue }),
      );

      actions.useAction(Actions.Update, (context) => {
        capturedValues.push(context.snapshot.external);
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

  it("should work without snapshot callback (empty snapshot)", async () => {
    let snapshotReceived = false;

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof Actions>(model);

      actions.useAction(Actions.Update, (context) => {
        // Snapshot should be an empty object when no callback is provided
        snapshotReceived = typeof context.snapshot === "object";
        context.actions.produce((draft) => {
          draft.model.value = "updated";
        });
      });

      return actions;
    });

    await act(async () => {
      result.current[1].dispatch(Actions.Update, "payload");
    });

    expect(snapshotReceived).toBe(true);
    expect(result.current[0].value).toBe("updated");
  });

  it("should handle multiple snapshot properties", async () => {
    const captured: { a?: number; b?: string; c?: boolean } = {};

    const { result } = renderHook(() => {
      const actions = useActions<
        Model,
        typeof Actions,
        { a: number; b: string; c: boolean }
      >(model, () => ({ a: 42, b: "hello", c: true }));

      actions.useAction(Actions.Update, (context) => {
        captured.a = context.snapshot.a;
        captured.b = context.snapshot.b;
        captured.c = context.snapshot.c;
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

  it("should provide fresh snapshot values across multiple dispatches", async () => {
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

        // Capture value after async - should be latest due to snapshot proxy
        capturedValues.push(context.snapshot.external);
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

    // The snapshot should provide the latest value
    expect(capturedValues[1]).toBe("changed");
  });
});
