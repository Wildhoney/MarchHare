---
to: src/shared/utils/<%= name %>/index.test.ts
---
import { describe, expect, it } from "vitest";
import { <%= camel(name) %> } from "./index.ts";

describe("<%= camel(name) %>", () => {
  it("returns a string", () => {
    expect(typeof <%= camel(name) %>("hello")).toBe("string");
  });
});
