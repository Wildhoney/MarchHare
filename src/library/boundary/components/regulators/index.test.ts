import { describe, expect, it } from "vitest";
import { isAllowed } from "./utils.ts";
import type { RegulatorPolicy } from "./types.ts";

const actionA = Symbol("chizu.action/A");
const actionB = Symbol("chizu.action/B");
const actionC = Symbol("chizu.action/C");

function policy(
  mode: RegulatorPolicy["mode"],
  actions: symbol[] = [],
): RegulatorPolicy {
  return { mode, actions: new Set(actions) };
}

describe("isAllowed()", () => {
  it("should allow everything in allow-all mode", () => {
    const p = policy("allow-all");
    expect(isAllowed(actionA, p)).toBe(true);
    expect(isAllowed(actionB, p)).toBe(true);
  });

  it("should block everything in disallow-all mode", () => {
    const p = policy("disallow-all");
    expect(isAllowed(actionA, p)).toBe(false);
    expect(isAllowed(actionB, p)).toBe(false);
  });

  it("should block only listed actions in disallow-matching mode", () => {
    const p = policy("disallow-matching", [actionA]);
    expect(isAllowed(actionA, p)).toBe(false);
    expect(isAllowed(actionB, p)).toBe(true);
    expect(isAllowed(actionC, p)).toBe(true);
  });

  it("should allow only listed actions in allow-matching mode", () => {
    const p = policy("allow-matching", [actionA, actionB]);
    expect(isAllowed(actionA, p)).toBe(true);
    expect(isAllowed(actionB, p)).toBe(true);
    expect(isAllowed(actionC, p)).toBe(false);
  });

  it("should handle empty action sets correctly", () => {
    expect(isAllowed(actionA, policy("disallow-matching"))).toBe(true);
    expect(isAllowed(actionA, policy("allow-matching"))).toBe(false);
  });
});
