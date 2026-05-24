import { describe, expect, it, vi } from "vitest";
import { Resource } from "./index.ts";
import { Cache, type Adapter } from "../cache/index.ts";
import type { Store } from "../boundary/components/store/index.tsx";

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

const noStore = <Store>{};

describe("Resource() fetcher invocation", () => {
  it("invokes the fetcher with { store, signal, params }", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);

    await user.run(noStore, undefined, {});

    expect(fetcher).toHaveBeenCalledWith({
      store: noStore,
      signal: undefined,
      params: {},
    });
  });

  it("forwards a non-empty store snapshot to the fetcher", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ ok: true }));
    const user = Resource(fetcher);
    const store = <Store>{ token: "abc-123" };

    await user.run(store, undefined, {});

    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ store }));
  });

  it("forwards params and signal to the fetcher", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params }: { params: Params }) =>
      Promise.resolve({ id: params.id }),
    );
    const item = Resource<{ id: number }, Params>(fetcher);
    const controller = new AbortController();

    await item.run(noStore, controller.signal, { id: 5 });

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: controller.signal,
        params: { id: 5 },
      }),
    );
  });

  it("propagates errors from the fetcher", async () => {
    const pay = Resource(() => Promise.reject(new Error("declined")));

    await expect(pay.run(noStore, undefined, {})).rejects.toThrow("declined");
  });

  it("runs fresh on every call (no in-flight coalescing)", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);

    await Promise.all([
      user.run(noStore, undefined, {}),
      user.run(noStore, undefined, {}),
      user.run(noStore, undefined, {}),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("Resource.get(params) sync read", () => {
  it("returns null before any successful fetch", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    expect(user.get()).toBeNull();
  });

  it("returns the cached payload after a successful fetch", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    await user.run(noStore, undefined, {});
    expect(user.get()).toEqual({ name: "Adam" });
  });

  it("returns null after a failed fetch (cache not poisoned)", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockRejectedValueOnce(new Error("boom"));
    const user = Resource(fetcher);

    await expect(user.run(noStore, undefined, {})).rejects.toThrow("boom");

    expect(user.get()).toBeNull();
  });

  it("returns null verbatim when the fetcher resolved with null", async () => {
    const user = Resource<string | null>(() => Promise.resolve(null));
    await user.run(noStore, undefined, {});

    // `.get()` returns null for both "not fetched" and "fetched a null".
    // Use the internal `.read()` to distinguish if needed.
    expect(user.get()).toBeNull();
    expect(user.read({}).data).toBeNull();
    expect(user.read({}).at).toBeInstanceOf(Temporal.Instant);
  });

  it("keeps separate cache slots for different params", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id, name: `User ${id}` }),
    );
    const user = Resource<{ id: number; name: string }, Params>(fetcher);

    await user.run(noStore, undefined, { id: 5 });
    await user.run(noStore, undefined, { id: 6 });

    expect(user.get({ id: 5 })).toEqual({ id: 5, name: "User 5" });
    expect(user.get({ id: 6 })).toEqual({ id: 6, name: "User 6" });
    expect(user.get({ id: 7 })).toBeNull();
  });

  it("is shared across all callers (cache is module-scope)", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    await user.run(noStore, undefined, {});
    // A second reference to the same Resource handle sees the cache.
    expect(user.get()).toEqual({ name: "Adam" });
  });
});

describe("AbortSignal", () => {
  it("aborts the fetch when the signal fires", async () => {
    const controller = new AbortController();
    const user = Resource<{ name: string }>(({ signal }) => {
      return new Promise<{ name: string }>((_resolve, reject) => {
        signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    const promise = user.run(noStore, controller.signal, {});
    controller.abort();

    await expect(promise).rejects.toThrow("aborted");
  });
});

describe("Resource(fetcher, cache)", () => {
  it("writes through to the supplied Cache on every successful fetch", async () => {
    const adapter = memoryAdapter();
    const cache = new Cache(adapter);
    const user = Resource(() => Promise.resolve({ name: "Adam" }), cache);

    await user.run(noStore, undefined, {});

    expect(adapter.entries.has("{}")).toBe(true);
    const stored = cache.get<{ name: string }>("{}");
    expect(stored.data).toEqual({ name: "Adam" });
  });

  it("seeds a fresh Resource from a persisted Cache (simulated reload)", async () => {
    const adapter = memoryAdapter();
    const first = Resource(
      () => Promise.resolve({ name: "FromFirst" }),
      new Cache(adapter),
    );

    await first.run(noStore, undefined, {});
    expect(adapter.entries.has("{}")).toBe(true);

    const fetcher = vi.fn(() => Promise.resolve({ name: "Network" }));
    const second = Resource(fetcher, new Cache(adapter));

    expect(second.get()).toEqual({ name: "FromFirst" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("per-params slots are persisted independently", async () => {
    type Params = { id: number };
    const adapter = memoryAdapter();
    const cache = new Cache(adapter);
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<{ id: number }, Params>(fetcher, cache);

    await item.run(noStore, undefined, { id: 5 });
    await item.run(noStore, undefined, { id: 6 });

    expect(adapter.entries.has('{"id":5}')).toBe(true);
    expect(adapter.entries.has('{"id":6}')).toBe(true);

    const reloaded = Resource<{ id: number }, Params>(
      fetcher,
      new Cache(adapter),
    );

    expect(reloaded.get({ id: 5 })).toEqual({ id: 5 });
    expect(reloaded.get({ id: 6 })).toEqual({ id: 6 });
  });

  it("falls back to the default in-memory Cache when none is supplied", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    expect(user.get()).toBeNull();
    await user.run(noStore, undefined, {});
    expect(user.get()).toEqual({ name: "Adam" });
  });
});

describe("Resource.seed(params, data, at)", () => {
  it("populates the per-params cache slot without invoking the fetcher", () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const at = Temporal.Now.instant();

    user.seed({}, { name: "Seeded" }, at);

    expect(user.get()).toEqual({ name: "Seeded" });
    expect(user.read({}).at?.toString()).toBe(at.toString());
    expect(fetcher).not.toHaveBeenCalled();
  });
});
