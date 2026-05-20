import { describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import * as React from "react";
import { pk, poll, sleep, store, unset, type Adapter } from "./index.ts";
import { useRerender } from "./utils.ts";

function memoryAdapter(): Adapter & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    get: (key) => entries.get(key) ?? null,
    set: (key, value) => {
      entries.set(key, value);
    },
    remove: (key) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  };
}

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

describe("store()", () => {
  it("returns an empty Stored for a missing key", () => {
    const s = store(memoryAdapter());
    const stored = s.get<string>("missing");

    expect(stored.data).toBe(unset);
    expect(stored.at).toBeNull();
    expect(stored.else("fallback")).toBe("fallback");
  });

  it("round-trips data and timestamp through set then get", () => {
    const adapter = memoryAdapter();
    const s = store(adapter);
    const at = Temporal.Now.instant();

    s.set("user", {
      data: { name: "Adam" },
      at,
      else: <U>(_: U) => ({ name: "Adam" }),
    });

    const stored = s.get<{ name: string }>("user");
    expect(stored.data).toEqual({ name: "Adam" });
    expect(stored.at?.toString()).toBe(at.toString());
    expect(stored.else(null)).toEqual({ name: "Adam" });
  });

  it("set is a no-op for an empty Stored (no key created)", () => {
    const adapter = memoryAdapter();
    const s = store(adapter);

    s.set("nothing", { data: unset, at: null, else: (f) => f });

    expect(adapter.entries.has("nothing")).toBe(false);
  });

  it("set is a no-op when at is missing even if data is present", () => {
    // Defensive: should never happen via the normal API, but the guard keeps
    // a hand-rolled Stored from writing a row with an unparseable timestamp.
    const adapter = memoryAdapter();
    const s = store(adapter);

    s.set("user", {
      data: { name: "Adam" },
      at: null,
      else: <U>(_: U) => ({ name: "Adam" }),
    });

    expect(adapter.entries.has("user")).toBe(false);
  });

  it("remove deletes the persisted entry", () => {
    const adapter = memoryAdapter();
    const s = store(adapter);
    const at = Temporal.Now.instant();

    s.set("user", {
      data: { name: "Adam" },
      at,
      else: <U>(_: U) => ({ name: "Adam" }),
    });
    expect(adapter.entries.has("user")).toBe(true);

    s.remove("user");
    expect(adapter.entries.has("user")).toBe(false);
  });

  it("returns an empty Stored for malformed JSON rather than throwing", () => {
    const adapter = memoryAdapter();
    adapter.entries.set("corrupt", "{not json");
    const s = store(adapter);

    const stored = s.get<string>("corrupt");
    expect(stored.data).toBe(unset);
    expect(stored.at).toBeNull();
  });

  it("returns an empty Stored when at fails to parse", () => {
    const adapter = memoryAdapter();
    adapter.entries.set(
      "broken-at",
      JSON.stringify({ data: { name: "Adam" }, at: "not-an-instant" }),
    );
    const s = store(adapter);

    const stored = s.get<{ name: string }>("broken-at");
    expect(stored.data).toBe(unset);
    expect(stored.at).toBeNull();
  });

  it("preserves a legitimately stored null payload through round-trip", () => {
    // Regression guard for the same UNSET sentinel semantics as Resource:
    // null is a valid payload, distinct from "nothing stored".
    const adapter = memoryAdapter();
    const s = store(adapter);
    const at = Temporal.Now.instant();

    s.set<string | null>("maybe", {
      data: null,
      at,
      else: <U>(_: U) => null,
    });

    const stored = s.get<string | null>("maybe");
    expect(stored.data).toBeNull();
    expect(stored.else("fallback")).toBeNull();
  });

  it("swallows adapter write errors so a resolved fetch isn't poisoned", () => {
    const s = store({
      get: () => null,
      set: () => {
        throw new Error("quota exceeded");
      },
      remove: () => {},
    });

    expect(() =>
      s.set("user", {
        data: { name: "Adam" },
        at: Temporal.Now.instant(),
        else: <U>(_: U) => ({ name: "Adam" }),
      }),
    ).not.toThrow();
  });
});
