import { describe, expect, it } from "vitest";
import { Action, isDistributedAction, getName } from "./index.ts";
import { Distribution } from "../types/index.ts";

describe("Action (unicast)", () => {
  it("should create a symbol with custom name", () => {
    const action = Action("increment");
    expect(typeof action).toBe("symbol");
    expect(action.toString()).toBe("Symbol(chizu.action/increment)");
  });
});

describe("Action (broadcast)", () => {
  it("should create a distributed symbol with custom name", () => {
    const action = Action("signed-out", Distribution.Broadcast);
    expect(typeof action).toBe("symbol");
    expect(action.toString()).toBe(
      "Symbol(chizu.action/distributed/signed-out)",
    );
  });
});

describe("isDistributedAction()", () => {
  it("should return true for distributed actions", () => {
    const distributed = Action("test", Distribution.Broadcast);
    expect(isDistributedAction(distributed)).toBe(true);
  });

  it("should return false for regular actions", () => {
    const regular = Action("test");
    expect(isDistributedAction(regular)).toBe(false);
  });
});

describe("getName()", () => {
  it("should extract name from regular action", () => {
    const action = Action("Increment");
    expect(getName(action)).toBe("Increment");
  });

  it("should extract name from distributed action", () => {
    const action = Action("SignedOut", Distribution.Broadcast);
    expect(getName(action)).toBe("SignedOut");
  });

  it("should handle hyphenated names", () => {
    const action = Action("fetch-user-data");
    expect(getName(action)).toBe("fetch-user-data");
  });

  it("should return unknown for malformed symbols", () => {
    const malformed = <symbol>(<unknown>Symbol("not-a-chizu-action"));
    expect(getName(malformed)).toBe("unknown");
  });
});
