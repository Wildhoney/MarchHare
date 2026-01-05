import { Regulator } from "./utils.ts";
import { Reason } from "../error/types.ts";
import { describe, expect, it, beforeEach } from "@jest/globals";

describe("Regulator", () => {
  const actionA = Symbol("ActionA");
  const actionB = Symbol("ActionB");

  it("should add and retrieve AbortController for an action", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    const controller = new AbortController();
    regulator.add(actionA, controller);
    const controllerB = new AbortController();
    regulator.add(actionB, controllerB);
    expect([...regulator["controllers"]].length).toBe(2);
  });

  it("should abort controller if action is disallowed", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    regulators.add(regulator);
    regulator.policy.disallow.matching([actionA]);
    const controller = regulator.controller(actionA);
    expect(controller.signal.aborted).toBe(true);
  });

  it("should allow action after being disallowed", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    regulators.add(regulator);
    regulator.policy.disallow.matching([actionA]);
    let controller = regulator.controller(actionA);
    expect(controller.signal.aborted).toBe(true);
    regulator.policy.allow.matching([actionA]);
    controller = regulator.controller(actionA);
    expect(controller.signal.aborted).toBe(false);
  });

  it("should abort all controllers", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    regulators.add(regulator);
    const controllerA = regulator.controller(actionA);
    const controllerB = regulator.controller(actionB);
    regulator.abort.all();
    expect(controllerA.signal.aborted).toBe(true);
    expect(controllerB.signal.aborted).toBe(true);
    expect([...regulator["controllers"]].length).toBe(0);
  });

  it("should abort controllers for a specific action", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    regulators.add(regulator);
    const controllerA = regulator.controller(actionA);
    const controllerB = regulator.controller(actionB);
    regulator.abort.matching([actionA]);
    expect(controllerA.signal.aborted).toBe(true);
    expect(controllerB.signal.aborted).toBe(false);
    expect([...regulator["controllers"]].length).toBe(1);
  });

  it("should abort own controllers only", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    regulators.add(regulator);
    const controllerA = regulator.controller(actionA);
    const controllerB = regulator.controller(actionB);
    regulator.abort.own();
    expect(controllerA.signal.aborted).toBe(true);
    expect(controllerB.signal.aborted).toBe(true);
    expect([...regulator["controllers"]].length).toBe(0);
  });

  it("should abort own controllers with specified reason", () => {
    const regulators: Set<Regulator> = new Set();
    const regulator = new Regulator(regulators);
    regulators.add(regulator);
    const controllerA = regulator.controller(actionA);
    const controllerB = regulator.controller(actionB);
    regulator.abort.own(Reason.Unmounted);
    expect(controllerA.signal.aborted).toBe(true);
    expect(controllerB.signal.aborted).toBe(true);
    expect(controllerA.signal.reason).toBe(Reason.Unmounted);
    expect(controllerB.signal.reason).toBe(Reason.Unmounted);
  });
});

describe("Regulator cross-component", () => {
  const actionA = Symbol("ActionA");
  const actionB = Symbol("ActionB");

  let regulators: Set<Regulator>;
  let regulator1: Regulator;
  let regulator2: Regulator;

  beforeEach(() => {
    regulators = new Set();
    regulator1 = new Regulator(regulators);
    regulator2 = new Regulator(regulators);
    regulators.add(regulator1);
    regulators.add(regulator2);
  });

  it("should abort all controllers across all regulators", () => {
    const controller1A = regulator1.controller(actionA);
    const controller1B = regulator1.controller(actionB);
    const controller2A = regulator2.controller(actionA);
    const controller2B = regulator2.controller(actionB);

    regulator1.abort.all();

    expect(controller1A.signal.aborted).toBe(true);
    expect(controller1B.signal.aborted).toBe(true);
    expect(controller2A.signal.aborted).toBe(true);
    expect(controller2B.signal.aborted).toBe(true);
  });

  it("should abort matching controllers across all regulators", () => {
    const controller1A = regulator1.controller(actionA);
    const controller1B = regulator1.controller(actionB);
    const controller2A = regulator2.controller(actionA);
    const controller2B = regulator2.controller(actionB);

    regulator1.abort.matching([actionA]);

    expect(controller1A.signal.aborted).toBe(true);
    expect(controller1B.signal.aborted).toBe(false);
    expect(controller2A.signal.aborted).toBe(true);
    expect(controller2B.signal.aborted).toBe(false);
  });

  it("should disallow action across all regulators", () => {
    regulator1.policy.disallow.matching([actionA]);

    const controller1A = regulator1.controller(actionA);
    const controller2A = regulator2.controller(actionA);

    expect(controller1A.signal.aborted).toBe(true);
    expect(controller2A.signal.aborted).toBe(true);
  });

  it("should allow action across all regulators after being disallowed", () => {
    regulator1.policy.disallow.matching([actionA]);
    regulator1.policy.allow.matching([actionA]);

    const controller1A = regulator1.controller(actionA);
    const controller2A = regulator2.controller(actionA);

    expect(controller1A.signal.aborted).toBe(false);
    expect(controller2A.signal.aborted).toBe(false);
  });

  it("should not affect removed regulator", () => {
    const controller1A = regulator1.controller(actionA);
    const controller2A = regulator2.controller(actionA);

    regulators.delete(regulator1);
    regulator2.abort.all();

    expect(controller1A.signal.aborted).toBe(false);
    expect(controller2A.signal.aborted).toBe(true);
  });

  it("should isolate regulators in different registries", () => {
    const regulators2: Set<Regulator> = new Set();
    const regulator3 = new Regulator(regulators2);
    regulators2.add(regulator3);

    const controller1A = regulator1.controller(actionA);
    const controller3A = regulator3.controller(actionA);

    regulator1.abort.all();

    expect(controller1A.signal.aborted).toBe(true);
    expect(controller3A.signal.aborted).toBe(false);
  });

  it("should abort own controllers without affecting other regulators", () => {
    const controller1A = regulator1.controller(actionA);
    const controller1B = regulator1.controller(actionB);
    const controller2A = regulator2.controller(actionA);
    const controller2B = regulator2.controller(actionB);

    regulator1.abort.own();

    expect(controller1A.signal.aborted).toBe(true);
    expect(controller1B.signal.aborted).toBe(true);
    expect(controller2A.signal.aborted).toBe(false);
    expect(controller2B.signal.aborted).toBe(false);
    expect([...regulator1["controllers"]].length).toBe(0);
    expect([...regulator2["controllers"]].length).toBe(2);
  });

  it("should clear own disallow policies without affecting other regulators", () => {
    regulator1.policy.disallow.matching([actionA]);
    regulator2.policy.disallow.matching([actionA]);

    regulator1.policy.allow.own();

    const controller1A = regulator1.controller(actionA);
    const controller2A = regulator2.controller(actionA);

    expect(controller1A.signal.aborted).toBe(false);
    expect(controller2A.signal.aborted).toBe(true);
  });

  it("should clear own allow policies without affecting other regulators", () => {
    // Add Allow policies directly to each regulator's local set (Policy.Allow = 0)
    regulator1["policies"].add({ rule: 0, action: actionA });
    regulator2["policies"].add({ rule: 0, action: actionA });

    regulator1.policy.disallow.own();

    // regulator1's Allow policy should be cleared
    expect([...regulator1["policies"]].length).toBe(0);
    // regulator2's Allow policy should remain
    expect([...regulator2["policies"]].length).toBe(1);
  });
});
