import { describe, it } from "vitest";
import { Action, Lifecycle, useActions } from "../index.ts";

/**
 * Type-level tests for `dispatch` and `useAction` argument constraints.
 *
 * These tests never run code at the assertion sites — they exist only to
 * trigger TypeScript at compile time. Each `@ts-expect-error` line will fail
 * the build if the corresponding type constraint is ever weakened.
 */

class Actions {
  static Mount = Lifecycle.Mount();
  static Plain = Action("Plain");
  static WithPayload = Action<string>("WithPayload");
}

class Foreign {
  static NotOnAC = Action("NotOnAC");
}

describe("dispatch typing", () => {
  it("rejects a missing payload when the action declares one", () => {
    function useUnderTest() {
      const actions = useActions<void, typeof Actions>();
      actions.useAction(Actions.Mount, (context) => {
        // OK — no payload required.
        context.actions.dispatch(Actions.Plain);

        // OK — payload supplied.
        context.actions.dispatch(Actions.WithPayload, "hello");

        // @ts-expect-error — Actions.WithPayload requires a string payload.
        context.actions.dispatch(Actions.WithPayload);

        // @ts-expect-error — Foreign.NotOnAC is not on the local Actions class.
        context.actions.dispatch(Foreign.NotOnAC);
      });
      return actions;
    }
    void useUnderTest;
  });

  it("applies the same constraint to the view-level dispatch tuple", () => {
    function useUnderTest() {
      const actions = useActions<void, typeof Actions>();
      // OK — no payload required.
      actions[1].dispatch(Actions.Plain);
      // OK — payload supplied.
      actions[1].dispatch(Actions.WithPayload, "hello");
      // @ts-expect-error — payload missing.
      actions[1].dispatch(Actions.WithPayload);
      // @ts-expect-error — foreign action.
      actions[1].dispatch(Foreign.NotOnAC);
      return actions;
    }
    void useUnderTest;
  });
});

describe("useAction typing", () => {
  it("rejects subscribing to actions outside AC (except Lifecycle.Fault)", () => {
    function useUnderTest() {
      const actions = useActions<void, typeof Actions>();
      // OK — Lifecycle.Fault is the documented escape hatch.
      actions.useAction(Lifecycle.Fault, () => {});
      // OK — on AC.
      actions.useAction(Actions.Plain, () => {});
      // @ts-expect-error — foreign action.
      actions.useAction(Foreign.NotOnAC, () => {});
      return actions;
    }
    void useUnderTest;
  });
});
