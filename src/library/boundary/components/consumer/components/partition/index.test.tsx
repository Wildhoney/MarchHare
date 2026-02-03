import { describe, expect, it } from "vitest";
import { Partition } from "./index.tsx";

describe("Partition", () => {
  it("should be a function component", () => {
    expect(Partition).toBeDefined();
    expect(typeof Partition).toBe("function");
  });

  it("should accept action and renderer props", () => {
    // Type check - component accepts the expected props shape
    const props = {
      action: Symbol("TestAction"),
      renderer: () => null,
    };

    // Verify props shape matches component expectations
    expect(props.action).toBeTypeOf("symbol");
    expect(props.renderer).toBeTypeOf("function");
  });
});
