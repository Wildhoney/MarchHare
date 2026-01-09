import { describe, expect, it } from "@jest/globals";
import { Action, isDistributedAction, getActionName } from "./index.ts";
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

describe("getActionName()", () => {
  it("should extract name from regular action", () => {
    const action = Action("Increment");
    expect(getActionName(action)).toBe("Increment");
  });

  it("should extract name from distributed action", () => {
    const action = Action("SignedOut", Distribution.Broadcast);
    expect(getActionName(action)).toBe("SignedOut");
  });

  it("should handle hyphenated names", () => {
    const action = Action("fetch-user-data");
    expect(getActionName(action)).toBe("fetch-user-data");
  });

  it("should return unknown for malformed symbols", () => {
    const malformed = <symbol>(<unknown>Symbol("not-a-chizu-action"));
    expect(getActionName(malformed)).toBe("unknown");
  });
});
