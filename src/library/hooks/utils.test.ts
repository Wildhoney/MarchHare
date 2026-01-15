import { describe, expect, it, jest } from "@jest/globals";
import { withGetters, isGenerator, Bound } from "./utils.ts";
import { getReason, getError } from "../utils/index.ts";
import { Reason, AbortError, TimeoutError } from "../error/index.tsx";
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

describe("Bound()", () => {
  function createMockContext<M>(model: M) {
    const capturedModel = { ...model };
    const produce = jest.fn((fn: (draft: { model: M }) => void) => {
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
    const handler = Bound("name");
    expect(typeof handler).toBe("function");
  });

  it("should update the specified model property with the payload", () => {
    type Model = { name: string; count: number };
    const { context, produce } = createMockContext<Model>({
      name: "initial",
      count: 0,
    });

    const handler = Bound("name");
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

    const handler = Bound("count");
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

    const handler = Bound("visitor");
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

    const handler = Bound("items");
    handler(context, ["a", "b", "c"]);

    expect(updatedModel.items).toEqual(["a", "b", "c"]);
  });
});
