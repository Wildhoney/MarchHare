import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import * as React from "react";
import { pk, poll, sleep } from "./index.ts";
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

    const promise = sleep(1_000, undefined);
    vi.advanceTimersByTime(1_000);

    await expect(promise).resolves.toBeUndefined();

    vi.useRealTimers();
  });
});

describe("poll()", () => {
  it("should resolve when the callback returns true", async () => {
    vi.useFakeTimers();

    let calls = 0;
    const promise = poll(500, undefined, () => {
      calls++;
      return calls >= 3;
    });

    // First call is immediate and returns false, so it sleeps.
    await vi.advanceTimersByTimeAsync(500);
    // Second call returns false, sleeps again.
    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toBeUndefined();
    expect(calls).toBe(3);

    vi.useRealTimers();
  });

  it("should reject immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(poll(500, controller.signal, () => false)).rejects.toThrow(
      "Aborted",
    );
  });

  it("should reject when signal is aborted during polling", async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    let calls = 0;

    const promise = poll(500, controller.signal, () => {
      calls++;
      return false;
    });

    // Flush microtasks so poll executes fn() and enters sleep().
    await vi.advanceTimersByTimeAsync(0);

    // Abort while poll is sleeping.
    controller.abort();

    await expect(promise).rejects.toThrow("Aborted");
    expect(calls).toBe(1);

    vi.useRealTimers();
  });

  it("should support async callbacks", async () => {
    vi.useFakeTimers();

    let calls = 0;
    const promise = poll(100, undefined, async () => {
      calls++;
      return calls >= 2;
    });

    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBeUndefined();
    expect(calls).toBe(2);

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
