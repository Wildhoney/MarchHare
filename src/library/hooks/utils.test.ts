import { describe, expect, it } from "@jest/globals";
import { withGetters, isGenerator } from "./utils.ts";

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
