import { describe, expect, it, jest } from "@jest/globals";
import { pk, sleep, set, checksum, Σ } from "./index.ts";

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

describe("checksum()", () => {
  it("should generate a deterministic hash for objects", () => {
    const obj = { name: "Adam", age: 30 };
    const hash1 = checksum(obj);
    const hash2 = checksum(obj);

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe("string");
  });

  it("should generate different hashes for different objects", () => {
    const hash1 = checksum({ a: 1 });
    const hash2 = checksum({ a: 2 });

    expect(hash1).not.toBe(hash2);
  });

  it("should handle arrays", () => {
    const hash1 = checksum([1, 2, 3]);
    const hash2 = checksum([1, 2, 3]);

    expect(hash1).toBe(hash2);
  });

  it("should handle primitives", () => {
    expect(checksum("hello")).toBe(checksum("hello"));
    expect(checksum(123)).toBe(checksum(123));
    expect(checksum(true)).toBe(checksum(true));
  });

  it("should be aliased as Σ", () => {
    expect(Σ).toBe(checksum);
  });
});
