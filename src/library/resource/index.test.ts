import { describe, expect, it, vi } from "vitest";
import { Resource, consumePending } from "./index.ts";
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
const noController = (): AbortController => new AbortController();

describe("Resource() fetcher invocation", () => {
  it("invokes the fetcher with { store, controller, params }", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const controller = noController();

    user();
    const call = consumePending();
    await call.run(noStore, controller, call.params);

    expect(fetcher).toHaveBeenCalledWith({
      store: noStore,
      controller,
      params: {},
    });
  });

  it("forwards a non-empty store snapshot to the fetcher", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ ok: true }));
    const user = Resource(fetcher);
    const store = <Store>{ token: "abc-123" };

    user();
    const call = consumePending();
    await call.run(store, noController(), call.params);

    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ store }));
  });

  it("forwards params and controller to the fetcher", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params }: { params: Params }) =>
      Promise.resolve({ id: params.id }),
    );
    const item = Resource<{ id: number }, Params>(fetcher);
    const controller = new AbortController();

    item({ id: 5 });
    const call = consumePending();
    await call.run(noStore, controller, call.params);

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        controller,
        params: { id: 5 },
      }),
    );
  });

  it("propagates errors from the fetcher", async () => {
    const pay = Resource(() => Promise.reject(new Error("declined")));

    pay();
    const call = consumePending();
    await expect(
      call.run(noStore, noController(), call.params),
    ).rejects.toThrow("declined");
  });

  it("runs fresh on every call (no in-flight coalescing)", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);

    const runOnce = async () => {
      user();
      const call = consumePending();
      await call.run(noStore, noController(), call.params);
    };

    await Promise.all([runOnce(), runOnce(), runOnce()]);

    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("Resource(params) sync read", () => {
  it("returns null before any successful fetch", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    expect(user()).toBeNull();
    consumePending();
  });

  it("returns the cached payload after a successful fetch", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    user();
    const first = consumePending();
    await first.run(noStore, noController(), first.params);

    expect(user()).toEqual({ name: "Adam" });
    consumePending();
  });

  it("returns null after a failed fetch (cache not poisoned)", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockRejectedValueOnce(new Error("boom"));
    const user = Resource(fetcher);

    user();
    const first = consumePending();
    await expect(
      first.run(noStore, noController(), first.params),
    ).rejects.toThrow("boom");

    expect(user()).toBeNull();
    consumePending();
  });

  it("returns null verbatim when the fetcher resolved with null", async () => {
    const user = Resource<string | null>(() => Promise.resolve(null));

    user();
    const first = consumePending();
    await first.run(noStore, noController(), first.params);

    // `user()` returns null for both "not fetched" and "fetched a null".
    expect(user()).toBeNull();
    const second = consumePending();
    expect(second.read({}).data).toBeNull();
    expect(second.read({}).at).toBeInstanceOf(Temporal.Instant);
  });

  it("keeps separate cache slots for different params", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id, name: `User ${id}` }),
    );
    const user = Resource<{ id: number; name: string }, Params>(fetcher);

    user({ id: 5 });
    const five = consumePending();
    await five.run(noStore, noController(), five.params);

    user({ id: 6 });
    const six = consumePending();
    await six.run(noStore, noController(), six.params);

    expect(user({ id: 5 })).toEqual({ id: 5, name: "User 5" });
    consumePending();
    expect(user({ id: 6 })).toEqual({ id: 6, name: "User 6" });
    consumePending();
    expect(user({ id: 7 })).toBeNull();
    consumePending();
  });
});

describe("AbortController", () => {
  it("aborts the fetch when the controller fires", async () => {
    const controller = new AbortController();
    const user = Resource<{ name: string }>(
      ({ controller: c }) =>
        new Promise<{ name: string }>((_resolve, reject) => {
          c.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    user();
    const call = consumePending();
    const promise = call.run(noStore, controller, call.params);
    controller.abort();

    await expect(promise).rejects.toThrow("aborted");
  });
});

describe("Resource(fetcher, cache)", () => {
  it("writes through to the supplied Cache on every successful fetch", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const user = Resource(() => Promise.resolve({ name: "Adam" }), cache);

    user();
    const call = consumePending();
    await call.run(noStore, noController(), call.params);

    expect(adapter.entries.has("{}")).toBe(true);
    const stored = cache.get<{ name: string }>("{}");
    expect(stored.data).toEqual({ name: "Adam" });
  });

  it("seeds a fresh Resource from a persisted Cache (simulated reload)", async () => {
    const adapter = memoryAdapter();
    const first = Resource(
      () => Promise.resolve({ name: "FromFirst" }),
      Cache(adapter),
    );

    first();
    const a = consumePending();
    await a.run(noStore, noController(), a.params);
    expect(adapter.entries.has("{}")).toBe(true);

    const fetcher = vi.fn(() => Promise.resolve({ name: "Network" }));
    const second = Resource(fetcher, Cache(adapter));

    expect(second()).toEqual({ name: "FromFirst" });
    consumePending();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("per-params slots are persisted independently", async () => {
    type Params = { id: number };
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<{ id: number }, Params>(fetcher, cache);

    item({ id: 5 });
    const five = consumePending();
    await five.run(noStore, noController(), five.params);

    item({ id: 6 });
    const six = consumePending();
    await six.run(noStore, noController(), six.params);

    expect(adapter.entries.has('{"id":5}')).toBe(true);
    expect(adapter.entries.has('{"id":6}')).toBe(true);

    const reloaded = Resource<{ id: number }, Params>(fetcher, Cache(adapter));

    expect(reloaded({ id: 5 })).toEqual({ id: 5 });
    consumePending();
    expect(reloaded({ id: 6 })).toEqual({ id: 6 });
    consumePending();
  });

  it("falls back to the default in-memory Cache when none is supplied", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    expect(user()).toBeNull();
    consumePending();

    user();
    const call = consumePending();
    await call.run(noStore, noController(), call.params);

    expect(user()).toEqual({ name: "Adam" });
    consumePending();
  });
});

describe("seed via .resource.set semantics", () => {
  it("populates the per-params cache slot without invoking the fetcher", () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const at = Temporal.Now.instant();

    user();
    const call = consumePending();
    call.seed({}, { name: "Seeded" }, at);

    expect(user()).toEqual({ name: "Seeded" });
    consumePending();

    user();
    expect(consumePending().read({}).at?.toString()).toBe(at.toString());
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("consumePending() invariants", () => {
  it("throws when called with no pending invocation", () => {
    // Drain any pending from prior tests.
    try {
      consumePending();
    } catch {
      // Intentionally swallowed.
    }
    expect(() => consumePending()).toThrow(
      /must be called with a fresh resource invocation/,
    );
  });

  it("clears the slot on next microtask if not consumed", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    user();
    await Promise.resolve(); // run microtasks
    expect(() => consumePending()).toThrow();
  });
});
