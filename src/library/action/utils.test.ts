import { describe, expect, it } from "vitest";
import {
  isBroadcastAction,
  isMulticastAction,
  getName,
  getActionSymbol,
  isChanneledAction,
} from "./utils.ts";
import { Action } from "./index.ts";
import { Distribution } from "../types/index.ts";

describe("getActionSymbol()", () => {
  it("should return string as-is", () => {
    expect(getActionSymbol("test")).toBe("test");
  });

  it("should return symbol as-is", () => {
    const sym = Symbol("test");
    expect(getActionSymbol(sym)).toBe(sym);
  });

  it("should extract symbol from action", () => {
    const action = Action("increment");
    expect(getActionSymbol(action).toString()).toBe(
      "Symbol(chizu.action/increment)",
    );
  });

  it("should extract symbol from channeled action", () => {
    const action = Action<number, { UserId: number }>("user-update");
    const channeled = action({ UserId: 5 });
    expect(getActionSymbol(channeled)).toBe(getActionSymbol(action));
  });
});

describe("isBroadcastAction()", () => {
  it("should return true for broadcast actions", () => {
    const broadcast = Action("test", Distribution.Broadcast);
    expect(isBroadcastAction(broadcast)).toBe(true);
  });

  it("should return false for regular actions", () => {
    const regular = Action("test");
    expect(isBroadcastAction(regular)).toBe(false);
  });

  it("should return false for multicast actions", () => {
    const multicast = Action("test", Distribution.Multicast);
    expect(isBroadcastAction(multicast)).toBe(false);
  });
});

describe("isMulticastAction()", () => {
  it("should return true for multicast actions", () => {
    const multicast = Action("test", Distribution.Multicast);
    expect(isMulticastAction(multicast)).toBe(true);
  });

  it("should return false for regular actions", () => {
    const regular = Action("test");
    expect(isMulticastAction(regular)).toBe(false);
  });

  it("should return false for broadcast actions", () => {
    const broadcast = Action("test", Distribution.Broadcast);
    expect(isMulticastAction(broadcast)).toBe(false);
  });
});

describe("getName()", () => {
  it("should extract name from regular action", () => {
    const action = Action("Increment");
    expect(getName(action)).toBe("Increment");
  });

  it("should extract name from broadcast action", () => {
    const action = Action("SignedOut", Distribution.Broadcast);
    expect(getName(action)).toBe("SignedOut");
  });

  it("should extract name from multicast action", () => {
    const action = Action("Update", Distribution.Multicast);
    expect(getName(action)).toBe("Update");
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

describe("isChanneledAction()", () => {
  it("should return false for regular action", () => {
    const action = Action<number, { UserId: number }>("user-update");
    expect(isChanneledAction(action)).toBe(false);
  });

  it("should return true for channeled action", () => {
    const action = Action<number, { UserId: number }>("user-update");
    const channeled = action({ UserId: 5 });
    expect(isChanneledAction(channeled)).toBe(true);
  });

  it("should return false for plain objects", () => {
    expect(isChanneledAction({})).toBe(false);
  });
});
