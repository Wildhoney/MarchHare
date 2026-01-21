import { describe, expect, it, vi } from "vitest";
import {
  withGetters,
  isGenerator,
  With,
  isFilteredAction,
  matchesFilter,
} from "./utils.ts";
import { getReason, getError } from "../error/utils.ts";
import { Reason, AbortError, TimeoutError } from "../error/index.tsx";
import { Action } from "../action/index.ts";
import type { HandlerContext } from "../types/index.ts";

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
  it("should return Reason.Timedout for TimeoutError", () => {
    const error = new TimeoutError();
    expect(getReason(error)).toBe(Reason.Timedout);
  });

  it("should return Reason.Supplanted for AbortError", () => {
    const error = new AbortError();
    expect(getReason(error)).toBe(Reason.Supplanted);
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
    const error = new TimeoutError();
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

describe("With()", () => {
  function createMockContext<M>(model: M) {
    const capturedModel = { ...model };
    const produce = vi.fn((fn: (draft: { model: M }) => void) => {
      fn({ model: capturedModel });
    });

    return {
      context: <HandlerContext<M, object, object>>(<unknown>{
        model,
        actions: { produce },
      }),
      getModel: () => capturedModel,
      produce,
    };
  }

  it("should return a handler function", () => {
    const handler = With("name");
    expect(typeof handler).toBe("function");
  });

  it("should update the specified model property with the payload", () => {
    type Model = { name: string; count: number };
    const { context, produce } = createMockContext<Model>({
      name: "initial",
      count: 0,
    });

    const handler = With("name");
    handler(context, "updated");

    expect(produce).toHaveBeenCalledTimes(1);
    expect(produce).toHaveBeenCalledWith(expect.any(Function));
  });

  it("should update a different property based on the key", () => {
    type Model = { name: string; count: number };
    const model: Model = { name: "test", count: 0 };
    const updatedModel = { ...model };

    const context = <HandlerContext<Model, object, object>>(<unknown>{
      model,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    const handler = With("count");
    handler(context, 42);

    expect(updatedModel.count).toBe(42);
  });

  it("should work with complex payload types", () => {
    type Country = { name: string; code: string };
    type Model = { visitor: Country | null };
    const model: Model = { visitor: null };
    const updatedModel = { ...model };

    const context = <HandlerContext<Model, object, object>>(<unknown>{
      model,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    const handler = With("visitor");
    handler(context, { name: "Japan", code: "JP" });

    expect(updatedModel.visitor).toEqual({ name: "Japan", code: "JP" });
  });

  it("should handle array properties", () => {
    type Model = { items: string[] };
    const model: Model = { items: [] };
    const updatedModel = { ...model };

    const context = <HandlerContext<Model, object, object>>(<unknown>{
      model,
      actions: {
        produce: (fn: (draft: { model: Model }) => void) => {
          fn({ model: updatedModel });
        },
      },
    });

    const handler = With("items");
    handler(context, ["a", "b", "c"]);

    expect(updatedModel.items).toEqual(["a", "b", "c"]);
  });
});

describe("isFilteredAction()", () => {
  const TestAction = Action<string>("Test");

  it("should return false for plain action symbols", () => {
    expect(isFilteredAction(TestAction)).toBe(false);
  });

  it("should return true for valid filtered action tuples", () => {
    expect(isFilteredAction([TestAction, { UserId: 1 }])).toBe(true);
    expect(isFilteredAction([TestAction, { Key: "value" }])).toBe(true);
    expect(isFilteredAction([TestAction, {}])).toBe(true);
  });

  it("should return false for arrays that are not valid action filters", () => {
    expect(isFilteredAction(<[symbol, object]>(<unknown>[TestAction]))).toBe(
      false,
    );
    expect(
      isFilteredAction(<[symbol, object]>(
        (<unknown>[TestAction, "not-an-object"])
      )),
    ).toBe(false);
    expect(
      isFilteredAction(<[symbol, object]>(<unknown>[TestAction, null])),
    ).toBe(false);
    expect(
      isFilteredAction(<[symbol, object]>(
        (<unknown>[TestAction, { a: 1 }, "extra"])
      )),
    ).toBe(false);
  });
});

describe("matchesFilter()", () => {
  it("should return true when dispatch filter matches registered filter exactly", () => {
    expect(matchesFilter({ UserId: 1 }, { UserId: 1 })).toBe(true);
    expect(matchesFilter({ Key: "value" }, { Key: "value" })).toBe(true);
  });

  it("should return true when dispatch filter is a subset of registered filter", () => {
    expect(matchesFilter({ UserId: 1 }, { UserId: 1, Role: "admin" })).toBe(
      true,
    );
    expect(matchesFilter({}, { UserId: 1 })).toBe(true);
  });

  it("should return false when dispatch filter has properties not matching registered filter", () => {
    expect(matchesFilter({ UserId: 1 }, { UserId: 2 })).toBe(false);
    expect(matchesFilter({ UserId: 1, Role: "admin" }, { UserId: 1 })).toBe(
      false,
    );
  });

  it("should return true for empty dispatch filter (matches all)", () => {
    expect(matchesFilter({}, {})).toBe(true);
    expect(matchesFilter({}, { Any: "value" })).toBe(true);
  });

  it("should handle different primitive types correctly", () => {
    expect(matchesFilter({ Flag: true }, { Flag: true })).toBe(true);
    expect(matchesFilter({ Flag: true }, { Flag: false })).toBe(false);
    const sym = Symbol("test");
    expect(matchesFilter({ Id: sym }, { Id: sym })).toBe(true);
  });
});
