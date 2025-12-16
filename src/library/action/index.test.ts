import { describe, expect, it } from "@jest/globals";
import {
  createAction,
  createDistributedAction,
  isDistributedAction,
} from "./index.ts";

describe("createAction()", () => {
  it("should create a symbol with default name", () => {
    const action = createAction();
    expect(typeof action).toBe("symbol");
    expect(action.toString()).toBe("Symbol(chizu.action/anonymous)");
  });

  it("should create a symbol with custom name", () => {
    const action = createAction("increment");
    expect(action.toString()).toBe("Symbol(chizu.action/increment)");
  });
});

describe("createDistributedAction()", () => {
  it("should create a distributed symbol with default name", () => {
    const action = createDistributedAction();
    expect(typeof action).toBe("symbol");
    expect(action.toString()).toBe(
      "Symbol(chizu.action/distributed/anonymous)",
    );
  });

  it("should create a distributed symbol with custom name", () => {
    const action = createDistributedAction("signed-out");
    expect(action.toString()).toBe(
      "Symbol(chizu.action/distributed/signed-out)",
    );
  });
});

describe("isDistributedAction()", () => {
  it("should return true for distributed actions", () => {
    const distributed = createDistributedAction("test");
    expect(isDistributedAction(distributed)).toBe(true);
  });

  it("should return false for regular actions", () => {
    const regular = createAction("test");
    expect(isDistributedAction(regular)).toBe(false);
  });
});
