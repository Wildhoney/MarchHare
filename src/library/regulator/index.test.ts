import Regulator from "./index.ts";
import { describe, expect, it } from "@jest/globals";

describe("Regulator", () => {
  const actionA = Symbol("ActionA");
  const actionB = Symbol("ActionB");

  it("should add and retrieve AbortController for an action", () => {
    const regulator = new Regulator();
    const controller = new AbortController();
    regulator.add(actionA, controller);
    const controllerB = new AbortController();
    regulator.add(actionB, controllerB);
    expect([...regulator["controllers"]].length).toBe(2);
  });

  it("should abort controller if action is disallowed", () => {
    const regulator = new Regulator();
    regulator.policy.disallow(actionA);
    const controller = regulator.controller(actionA);
    expect(controller.signal.aborted).toBe(true);
  });

  it("should allow action after being disallowed", () => {
    const regulator = new Regulator();
    regulator.policy.disallow(actionA);
    let controller = regulator.controller(actionA);
    expect(controller.signal.aborted).toBe(true);
    regulator.policy.allow(actionA);
    controller = regulator.controller(actionA);
    expect(controller.signal.aborted).toBe(false);
  });

  it("should abort all controllers", () => {
    const regulator = new Regulator();
    const controllerA = regulator.controller(actionA);
    const controllerB = regulator.controller(actionB);
    regulator.abort.all();
    expect(controllerA.signal.aborted).toBe(true);
    expect(controllerB.signal.aborted).toBe(true);
    expect([...regulator["controllers"]].length).toBe(0);
  });

  it("should abort controllers for a specific action", () => {
    const regulator = new Regulator();
    const controllerA = regulator.controller(actionA);
    const controllerB = regulator.controller(actionB);
    regulator.abort.matching(actionA);
    expect(controllerA.signal.aborted).toBe(true);
    expect(controllerB.signal.aborted).toBe(false);
    expect([...regulator["controllers"]].length).toBe(1);
  });
});
