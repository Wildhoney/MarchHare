import { describe, expect, it, jest } from "@jest/globals";
import { pk, sleep, set } from "./index.ts";

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
    const setter = set("name");
    const draft = { name: "initial" };
    const context = {
      actions: {
        produce: (fn: (d: typeof draft) => void) => fn(draft),
      },
    };

    setter(context as never, "updated" as never);

    expect(draft.name).toBe("updated");
  });
});
