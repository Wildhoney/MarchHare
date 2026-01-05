import { describe, expect, it } from "@jest/globals";
import { withGetters, isGenerator } from "./utils.ts";
import { getReason, normaliseError } from "../utils/index.ts";
import { Reason, AbortError, TimeoutError } from "../error/index.tsx";

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

describe("normaliseError()", () => {
  it("should return the same Error if already an Error", () => {
    const error = new Error("original");
    expect(normaliseError(error)).toBe(error);
  });

  it("should preserve custom error instances", () => {
    const error = new TimeoutError();
    expect(normaliseError(error)).toBe(error);
  });

  it("should wrap thrown strings", () => {
    const result = normaliseError("oops");
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("oops");
  });

  it("should wrap thrown numbers", () => {
    const result = normaliseError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  it("should wrap thrown objects", () => {
    const result = normaliseError({ code: 500 });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });

  it("should wrap null", () => {
    const result = normaliseError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  it("should wrap undefined", () => {
    const result = normaliseError(undefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("undefined");
  });
});
