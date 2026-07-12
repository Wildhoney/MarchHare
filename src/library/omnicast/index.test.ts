import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Omnicast, isOmnicastAction, schemaOf } from "./index.ts";
import { Action } from "../action/index.ts";
import { getName, isBroadcastAction } from "../action/utils.ts";
import { Distribution } from "../types/index.ts";

const cat = z.object({ id: z.string(), name: z.string() });

describe("Omnicast()", () => {
  it("creates a broadcast-distributed action", () => {
    const adopted = Omnicast("Cat.Adopted", cat);
    expect(isBroadcastAction(adopted)).toBe(true);
    expect(getName(adopted)).toBe("Cat.Adopted");
  });

  it("carries the schema for the wire to validate against", () => {
    const adopted = Omnicast("Cat.Adopted", cat);
    expect(schemaOf(adopted)).toBe(cat);
  });

  it("carries a null schema for payloadless events", () => {
    const opened = Omnicast("Cattery.Opened");
    expect(schemaOf(opened)).toBeNull();
  });
});

describe("isOmnicastAction()", () => {
  it("accepts omnicast actions", () => {
    expect(isOmnicastAction(Omnicast("Cat.Adopted", cat))).toBe(true);
  });

  it("rejects plain broadcast and unicast actions", () => {
    expect(
      isOmnicastAction(Action<string>("Cat.Added", Distribution.Broadcast)),
    ).toBe(false);
    expect(isOmnicastAction(Action("AddCat.Click"))).toBe(false);
  });

  it("rejects primitives and nulls", () => {
    expect(isOmnicastAction(null)).toBe(false);
    expect(isOmnicastAction("Cat.Adopted")).toBe(false);
  });
});
