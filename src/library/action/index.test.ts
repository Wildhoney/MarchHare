import { describe, expect, it } from "vitest";
import {
  Action,
  isDistributedAction,
  getName,
  getActionSymbol,
  isChanneledAction,
} from "./index.ts";
import { Distribution, ActionSymbol } from "../types/index.ts";

describe("Action (unicast)", () => {
  it("should create a callable action with an internal symbol", () => {
    const action = Action("increment");
    expect(typeof action).toBe("function");
    expect(ActionSymbol in action).toBe(true);
    expect(getActionSymbol(action).toString()).toBe(
      "Symbol(chizu.action/increment)",
    );
  });

  it("should be callable to create a channeled action", () => {
    const action = Action<number, { UserId: number }>("user-update");
    const channeled = action({ UserId: 5 });
    expect(isChanneledAction(channeled)).toBe(true);
    expect(channeled.channel).toEqual({ UserId: 5 });
    expect(getActionSymbol(channeled)).toBe(getActionSymbol(action));
  });
});

describe("Action (broadcast)", () => {
  it("should create a distributed callable action with an internal symbol", () => {
    const action = Action("signed-out", Distribution.Broadcast);
    expect(typeof action).toBe("function");
    expect(ActionSymbol in action).toBe(true);
    expect(getActionSymbol(action).toString()).toBe(
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
