import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import * as React from "react";
import { pk, sleep } from "./index.ts";
import { useRerender } from "./utils.ts";

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
    vi.useFakeTimers();

    const promise = sleep(1_000);
    vi.advanceTimersByTime(1_000);

    await expect(promise).resolves.toBeUndefined();

    vi.useRealTimers();
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
