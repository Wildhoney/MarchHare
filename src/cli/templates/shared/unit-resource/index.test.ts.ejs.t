---
to: src/shared/resources/<%= name %>/index.test.ts
---
import { describe, expect, it } from "vitest";
import { fetch } from "./index.ts";

describe("resource.<%= name %>", () => {
  it("exposes a fetcher handle", () => {
    expect(typeof fetch).toBe("function");
  });

  it("returns null on the first sync call (cache miss)", () => {
    expect(fetch.get()).toBeNull();
  });
});
