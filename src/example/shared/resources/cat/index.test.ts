import { describe, expect, it } from "vitest";
import * as resource from "@example/shared/resources/index.ts";

describe("resource.cat", () => {
  it("exposes an image handle from the resources barrel", () => {
    expect(typeof resource.cat.image).toBe("function");
  });

  it("returns null on the first sync call (cache miss)", () => {
    expect(resource.cat.image.get()).toBeNull();
  });
});
