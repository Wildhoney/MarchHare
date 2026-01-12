import { describe, expect, it, jest } from "@jest/globals";
import { render, act } from "@testing-library/react";
import * as React from "react";
import { Inspect } from "immertation";
import { pk, sleep, set, checksum, Σ } from "./index.ts";
import { useRerender } from "./utils.ts";
import { ActionsClass, Context, Payload } from "../types/index.ts";

describe("pk()", () => {
  it("should generate a unique symbol when called without arguments", () => {
    const key1 = pk();
    const key2 = pk();

    expect(typeof key1).toBe("symbol");
    expect(typeof key2).toBe("symbol");
    expect(key1).not.toBe(key2);
  });

  it("should return true for valid primary keys", () => {
    expect(pk("abc")).toBe(true);
    expect(pk(123)).toBe(true);
    expect(pk(1)).toBe(true);
  });

  it("should return false for symbol primary keys", () => {
    expect(pk(Symbol("test"))).toBe(false);
  });
});

describe("sleep()", () => {
  it("should resolve after the specified time", async () => {
    jest.useFakeTimers();

    const promise = sleep(1_000);
    jest.advanceTimersByTime(1_000);

    await expect(promise).resolves.toBeUndefined();

    jest.useRealTimers();
  });
});

describe("set()", () => {
  it("should create a setter action for a property", () => {
    type TestModel = { name: string };
    const setter = set<TestModel, ActionsClass>("name");
    const model: TestModel = { name: "initial" };
    const context: Pick<Context<TestModel, ActionsClass>, "actions"> = {
      actions: {
        produce: (fn) => {
          fn({ model, inspect: <Inspect<TestModel>>{} });
          return model;
        },
        dispatch: () => {},
        annotate: <T>(_, value: T) => value,
      },
    };

    setter(<Context<TestModel, ActionsClass>>context, <Payload>"updated");

    expect(model.name).toBe("updated");
  });
});

describe("checksum()", () => {
  it("should return a string for valid objects", () => {
    expect(typeof checksum({ name: "Adam" })).toBe("string");
  });

  it("should generate different hashes for different values", () => {
    expect(checksum({ a: 1 })).not.toBe(checksum({ a: 2 }));
  });

  it("should return null for circular references", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;

    expect(checksum(obj)).toBeNull();
  });

  it("should be aliased as Σ", () => {
    expect(Σ).toBe(checksum);
  });
});

describe("useRerender()", () => {
  it("should trigger a re-render when called", () => {
    let renderCount = 0;
    let triggerRerender: () => void;

    function TestComponent() {
      renderCount++;
      triggerRerender = useRerender();
      return null;
    }

    render(React.createElement(TestComponent));
    expect(renderCount).toBe(1);

    act(() => {
      triggerRerender();
    });
    expect(renderCount).toBe(2);

    act(() => {
      triggerRerender();
    });
    expect(renderCount).toBe(3);
  });
});
