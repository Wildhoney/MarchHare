import { describe, expect, it } from "vitest";
import {
  isBroadcastAction,
  isMulticastAction,
  getName,
  getActionSymbol,
  isChanneledAction,
  isReactiveBinding,
} from "./utils.ts";
import { Action } from "./index.ts";
import { Distribution, Lifecycle } from "../types/index.ts";

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
      "Symbol(march-hare.action/increment)",
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
    const malformed = <symbol>(<unknown>Symbol("not-a-march-hare-action"));
    expect(getName(malformed)).toBe("unknown");
  });

  it("should extract the kind from a lifecycle action", () => {
    const action = Lifecycle.Mount();
    expect(getName(action)).toBe("Mount");
  });

  it("should extract the supplied name from a named reactive action", () => {
    const action = Lifecycle.Reactive<string>("Profile");
    expect(getName(action)).toBe("Profile");
  });

  it("should fall back to the kind for an unnamed reactive action", () => {
    const action = Lifecycle.Reactive<string>();
    expect(getName(action)).toBe("Reactive");
  });
});

describe("isReactiveBinding()", () => {
  it("should return false for the uncalled reactive static", () => {
    const action = Lifecycle.Reactive<string>("Profile");
    expect(isReactiveBinding(action)).toBe(false);
  });

  it("should return true for a bound value", () => {
    const action = Lifecycle.Reactive<string>("Profile");
    expect(isReactiveBinding(action("Adam"))).toBe(true);
  });

  it("should return false for regular and channeled actions", () => {
    const regular = Action<string>("Plain");
    const channeled = Action<string, { UserId: number }>("Filtered");
    expect(isReactiveBinding(regular)).toBe(false);
    expect(isReactiveBinding(channeled({ UserId: 1 }))).toBe(false);
  });

  it("should expose the bound value on the binding", () => {
    const action = Lifecycle.Reactive<string>("Profile");
    expect(action("Adam").value).toBe("Adam");
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
