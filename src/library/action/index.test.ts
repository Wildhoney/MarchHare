import { describe, expect, it } from "vitest";
import { Action, getActionSymbol, isChanneledAction } from "./index.ts";
import { Distribution, Brand } from "../types/index.ts";

describe("Action (unicast)", () => {
  it("should create a callable action with an internal symbol", () => {
    const action = Action("increment");
    expect(typeof action).toBe("function");
    expect(Brand.Action in action).toBe(true);
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
  it("should create a broadcast callable action with an internal symbol", () => {
    const action = Action("signed-out", Distribution.Broadcast);
    expect(typeof action).toBe("function");
    expect(Brand.Action in action).toBe(true);
    expect(getActionSymbol(action).toString()).toBe(
      "Symbol(chizu.action/broadcast/signed-out)",
    );
  });
});

describe("Action (multicast)", () => {
  it("should create a multicast callable action with an internal symbol", () => {
    const action = Action("update", Distribution.Multicast);
    expect(typeof action).toBe("function");
    expect(Brand.Action in action).toBe(true);
    expect(getActionSymbol(action).toString()).toBe(
      "Symbol(chizu.action/multicast/update)",
    );
  });
});
