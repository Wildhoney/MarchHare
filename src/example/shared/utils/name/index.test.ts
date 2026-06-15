import { describe, expect, it } from "vitest";
import { name } from "./index.ts";

describe("name", () => {
  it("returns a non-empty string", () => {
    const result = name();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns varied values across calls", () => {
    const values = new Set(Array.from({ length: 20 }, () => name()));
    expect(values.size).toBeGreaterThan(1);
  });
});
