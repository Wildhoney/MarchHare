import { describe, expect, it, vi } from "vitest";
import {
  withGetters,
  isGenerator,
  isChanneledAction,
  matchesChannel,
} from "./utils.ts";
import { With } from "../with/index.ts";
import { getReason, getError } from "../error/utils.ts";
import { Reason, Aborted } from "../error/index.ts";
import { Action } from "../action/index.ts";
import type { AnyAction, HandlerContext, Model } from "../types/index.ts";

describe("withGetters()", () => {
  it("should create getters that access ref values", () => {
    const model = { name: "initial", count: 0 };
    const ref = { current: model };

    const proxy = withGetters(model, ref);

    expect(proxy.name).toBe("initial");
    expect(proxy.count).toBe(0);

    ref.current = { name: "updated", count: 42 };

    expect(proxy.name).toBe("updated");
    expect(proxy.count).toBe(42);
  });

  it("should make properties enumerable", () => {
    const model = { a: 1, b: 2 };
    const ref = { current: model };

    const proxy = withGetters(model, ref);

    expect(Object.keys(proxy)).toEqual(["a", "b"]);
  });
});

describe("isGenerator()", () => {
  it("should return false for null", () => {
    expect(isGenerator(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isGenerator(undefined)).toBe(false);
  });

  it("should return false for regular objects", () => {
    expect(isGenerator({})).toBe(false);
    expect(isGenerator({ next: () => {} })).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isGenerator([1, 2, 3])).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isGenerator(42)).toBe(false);
    expect(isGenerator("string")).toBe(false);
    expect(isGenerator(true)).toBe(false);
  });

  it("should return false for promises", () => {
    expect(isGenerator(Promise.resolve())).toBe(false);
  });
});

describe("getReason()", () => {
  it("should return Reason.Aborted for Aborted", () => {
    const error = new Aborted();
    expect(getReason(error)).toBe(Reason.Aborted);
  });

  it("should return Reason.Aborted for native AbortError DOMException", () => {
    const error = new DOMException("aborted", "AbortError");
    expect(getReason(error)).toBe(Reason.Aborted);
  });

  it("should return Reason.Errored for regular Error", () => {
    const error = new Error("Something went wrong");
    expect(getReason(error)).toBe(Reason.Errored);
  });

  it("should return Reason.Errored for thrown strings", () => {
    expect(getReason("oops")).toBe(Reason.Errored);
  });

  it("should return Reason.Errored for thrown objects", () => {
    expect(getReason({ message: "error" })).toBe(Reason.Errored);
  });

  it("should return Reason.Errored for other error types", () => {
    const error = new TypeError("Not a function");
    expect(getReason(error)).toBe(Reason.Errored);
  });
});

describe("getError()", () => {
  it("should return the same Error if already an Error", () => {
    const error = new Error("original");
    expect(getError(error)).toBe(error);
  });

  it("should preserve custom error instances", () => {
    const error = new Aborted();
    expect(getError(error)).toBe(error);
  });

  it("should wrap thrown strings", () => {
    const result = getError("oops");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("oops");
  });

  it("should wrap thrown numbers", () => {
    const result = getError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("should wrap thrown objects", () => {
    const result = getError({ code: 500 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });

  it("should wrap null", () => {
    const result = getError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("should wrap undefined", () => {
    const result = getError(undefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("undefined");
  });
});

describe("With.Update()", () => {
  function createMockContext<M extends Model>(model: M) {
    const capturedModel = { ...model };
    const produce = vi.fn((fn: (draft: { model: M }) => void) => {
      fn({ model: capturedModel });
    });

    return {
      context: <HandlerContext<M, void>>(<unknown>{
        model,
        actions: { produce },
      }),
      getModel: () => capturedModel,
      produce,
    };
  }

  it("should return a handler function", () => {
    const handler = With.Update("name");
    expect(typeof handler).toBe("function");
  });

  it("should update the specified model property with the payload", () => {
    type Model = { name: string; count: number };
    const { context, produce } = createMockContext<Model>({
      name: "initial",
      count: 0,
    });

    const handler = With.Update("name");
    handler(context, "updated");

    expect(produce).toHaveBeenCalledTimes(1);
    expect(produce).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should update a different property based on the key", () => {
    type Model = { name: string; count: number };
    const model: Model = { name: "test", count: 0 };
    const updatedModel = { ...model };

    const context = <HandlerContext<Model, void>>(<unknown>{
      model: updatedModel,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    const handler = With.Update("count");
    handler(context, 42);

    expect(updatedModel.count).toBe(42);
  });

  it("should work with complex payload types", () => {
    type Country = { name: string; code: string };
    type Model = { visitor: Country | null };
    const model: Model = { visitor: null };
    const updatedModel = { ...model };

    const context = <HandlerContext<Model, void>>(<unknown>{
      model: updatedModel,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    const handler = With.Update("visitor");
    handler(context, { name: "Japan", code: "JP" });

    expect(updatedModel.visitor).toEqual({ name: "Japan", code: "JP" });
  });

  it("should handle array properties", () => {
    type Model = { items: string[] };
    const model: Model = { items: [] };
    const updatedModel = { ...model };

    const context = <HandlerContext<Model, void>>(<unknown>{
      model: updatedModel,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    const handler = With.Update("items");
    handler(context, ["a", "b", "c"]);

    expect(updatedModel.items).toEqual(["a", "b", "c"]);
  });
});

describe("With.Invert()", () => {
  it("should flip a boolean field from false to true", () => {
    type Model = { sidebar: boolean };
    const updatedModel: Model = { sidebar: false };

    const context = <HandlerContext<Model, void>>(<unknown>{
      model: updatedModel,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    With.Invert("sidebar")(context);
    expect(updatedModel.sidebar).toBe(true);
  });

  it("should flip a boolean field from true to false", () => {
    type Model = { sidebar: boolean };
    const updatedModel: Model = { sidebar: true };

    const context = <HandlerContext<Model, void>>(<unknown>{
      model: updatedModel,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    With.Invert("sidebar")(context);
    expect(updatedModel.sidebar).toBe(false);
  });

  it("should toggle a boolean field without inspecting any payload", () => {
    type Model = { open: boolean };
    const updatedModel: Model = { open: false };

    const context = <HandlerContext<Model, void>>(<unknown>{
      model: updatedModel,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    With.Invert("open")(context);
    expect(updatedModel.open).toBe(true);
  });
});

describe("isChanneledAction()", () => {
  const TestAction = Action<string, { UserId: number }>("Test");

  it("should return false for plain actions", () => {
    expect(isChanneledAction(TestAction)).toBe(false);
  });

  it("should return true for channeled actions created by calling Action(channel)", () => {
    const channeled = TestAction({ UserId: 1 });
    expect(isChanneledAction(channeled)).toBe(true);
    expect(channeled.channel).toEqual({ UserId: 1 });
  });

  it("should return false for non-channeled values", () => {
    expect(isChanneledAction(<AnyAction>(<unknown>{}))).toBe(false);
    expect(isChanneledAction(<AnyAction>(<unknown>{ channel: 1 }))).toBe(false);
    expect(isChanneledAction(<AnyAction>(<unknown>null))).toBe(false);
    expect(isChanneledAction(Symbol("test"))).toBe(false);
  });
});

describe("matchesChannel()", () => {
  it("returns true when the dispatch channel matches the subscriber's filter exactly", () => {
    expect(matchesChannel({ UserId: 1 }, { UserId: 1 })).toBe(true);
    expect(matchesChannel({ Key: "value" }, { Key: "value" })).toBe(true);
  });

  it("returns true when the subscriber's filter is a subset of the dispatch channel", () => {
    expect(matchesChannel({ UserId: 1, Role: "admin" }, { UserId: 1 })).toBe(
      true,
    );
    expect(
      matchesChannel(
        { UserId: 1, Role: "admin", OrgId: 5 },
        { UserId: 1, Role: "admin" },
      ),
    ).toBe(true);
  });

  it("returns false when the subscriber asked for a key the dispatcher did not supply", () => {
    expect(matchesChannel({ UserId: 1 }, { UserId: 1, Role: "admin" })).toBe(
      false,
    );
    expect(matchesChannel({}, { UserId: 1 })).toBe(false);
  });

  it("returns false on value mismatch for any key the subscriber asked for", () => {
    expect(matchesChannel({ UserId: 1 }, { UserId: 2 })).toBe(false);
    expect(
      matchesChannel(
        { UserId: 1, Role: "admin" },
        { UserId: 1, Role: "viewer" },
      ),
    ).toBe(false);
  });

  it("returns true when the subscriber's filter is empty (no keys to satisfy)", () => {
    expect(matchesChannel({}, {})).toBe(true);
    expect(matchesChannel({ UserId: 1, Role: "admin" }, {})).toBe(true);
  });

  it("handles different primitive types correctly", () => {
    expect(matchesChannel({ Flag: true }, { Flag: true })).toBe(true);
    expect(matchesChannel({ Flag: true }, { Flag: false })).toBe(false);
    const sym = Symbol("test");
    expect(matchesChannel({ Id: sym }, { Id: sym })).toBe(true);
    expect(matchesChannel({ Id: sym }, { Id: Symbol("test") })).toBe(false);
    expect(matchesChannel({ Count: 0 }, { Count: 0 })).toBe(true);
    expect(matchesChannel({ Count: 0 }, { Count: -0 })).toBe(true);
  });
});
