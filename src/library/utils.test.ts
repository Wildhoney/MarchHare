import { describe, test, expect } from "vitest";
import { changes } from "./utils.ts";

describe("structural change detection", () => {
  test("updated and new keys", () => {
    const prev = { a: 1, b: 2 };
    const next = { a: 1, b: 3, c: 4 };
    expect(changes(prev, next)).toEqual({
      b: 3,
      c: 4,
    });
  });

  test("nested object change", () => {
    const prev = { a: { name: "Adam" } };
    const next = { a: { name: "Maria" } };
    expect(changes(prev, next)).toEqual({
      a: { name: "Maria" },
    });
  });

  test("array reorder is change", () => {
    const prev = { arr: [1, 2, 3] };
    const next = { arr: [3, 2, 1] };
    expect(changes(prev, next)).toEqual({
      arr: [3, 2, 1],
    });
  });
});
