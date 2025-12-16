import { describe, expect, it } from "@jest/globals";
import { actionName } from "./utils.ts";

describe("actionName()", () => {
  it("should return the string as-is for string input", () => {
    expect(actionName("increment")).toBe("increment");
    expect(actionName("decrement")).toBe("decrement");
  });

  it("should return symbolbol description for symbolbol input", () => {
    const symbol = Symbol("my-action");
    expect(actionName(symbol)).toBe("my-action");
  });

  it("should return 'unknown' for symbolbol without description", () => {
    const symbol = Symbol();
    expect(actionName(symbol)).toBe("unknown");
  });
});
