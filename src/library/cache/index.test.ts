import { describe, expect, it } from "vitest";
import { Cache, type Adapter } from "./index.ts";
import { unset } from "../utils/index.ts";

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

describe("Cache (persistent)", () => {
  it("returns an empty Stored for a missing key", () => {
    const cache = Cache(memoryAdapter());
    const stored = cache.get<string>("missing");

    expect(stored.data).toBe(unset);
    expect(stored.at).toBeNull();
  });

  it("round-trips data and timestamp through set then get", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const at = Temporal.Now.instant();

    await cache.set("user", { data: { name: "Adam" }, at });

    const stored = cache.get<{ name: string }>("user");
    expect(stored.data).toEqual({ name: "Adam" });
    expect(stored.at?.toString()).toBe(at.toString());
  });

  it("set is a no-op for an empty Stored (no key created)", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);

    await cache.set("nothing", { data: unset, at: null });

    expect(adapter.entries.has("nothing")).toBe(false);
  });

  it("set is a no-op when at is missing even if data is present", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);

    await cache.set("user", { data: { name: "Adam" }, at: null });

    expect(adapter.entries.has("user")).toBe(false);
  });

  it("remove deletes the persisted entry", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const at = Temporal.Now.instant();

    await cache.set("user", { data: { name: "Adam" }, at });
    expect(adapter.entries.has("user")).toBe(true);

    await cache.remove("user");
    expect(adapter.entries.has("user")).toBe(false);
  });

  it("returns an empty Stored for malformed JSON rather than throwing", () => {
    const adapter = memoryAdapter();
    adapter.entries.set("corrupt", "{not json");
    const cache = Cache(adapter);

    const stored = cache.get<string>("corrupt");
    expect(stored.data).toBe(unset);
    expect(stored.at).toBeNull();
  });

  it("returns an empty Stored when at fails to parse", () => {
    const adapter = memoryAdapter();
    adapter.entries.set(
      "broken-at",
      JSON.stringify({ data: { name: "Adam" }, at: "not-an-instant" }),
    );
    const cache = Cache(adapter);

    const stored = cache.get<{ name: string }>("broken-at");
    expect(stored.data).toBe(unset);
    expect(stored.at).toBeNull();
  });

  it("preserves a legitimately stored null payload through round-trip", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const at = Temporal.Now.instant();

    await cache.set<string | null>("maybe", { data: null, at });

    const stored = cache.get<string | null>("maybe");
    expect(stored.data).toBeNull();
  });

  it("swallows adapter write errors so a resolved fetch isn't poisoned", async () => {
    const cache = Cache({
      get: () => null,
      set: () => {
        throw new Error("quota exceeded");
      },
      remove: () => {},
      clear: () => {},
    });

    await expect(
      cache.set("user", {
        data: { name: "Adam" },
        at: Temporal.Now.instant(),
      }),
    ).resolves.toBeUndefined();
  });

  it("clear wipes every entry", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const at = Temporal.Now.instant();

    await cache.set("a", { data: 1, at });
    await cache.set("b", { data: 2, at });
    expect(adapter.entries.size).toBe(2);

    await cache.clear();
    expect(adapter.entries.size).toBe(0);
  });
});

describe("Cache (in-memory, no adapter)", () => {
  it("works as a scoped in-memory store", async () => {
    const cache = Cache();
    const at = Temporal.Now.instant();

    await cache.set("user", { data: { name: "Adam" }, at });

    expect(cache.get<{ name: string }>("user").data).toEqual({ name: "Adam" });
  });

  it("two in-memory caches are independent", async () => {
    const a = Cache();
    const b = Cache();
    const at = Temporal.Now.instant();

    await a.set("user", { data: { name: "Adam" }, at });

    expect(a.get<{ name: string }>("user").data).toEqual({ name: "Adam" });
    expect(b.get<{ name: string }>("user").data).toBe(unset);
  });

  it("clear empties the in-memory entries", async () => {
    const cache = Cache();
    const at = Temporal.Now.instant();

    await cache.set("a", { data: 1, at });
    await cache.clear();

    expect(cache.get<number>("a").data).toBe(unset);
  });
});
