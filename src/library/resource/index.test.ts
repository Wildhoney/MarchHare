import { describe, expect, it, vi } from "vitest";
import { Resource, consumePending } from "./index.ts";
import { Cache, type Adapter } from "../cache/index.ts";
import type { Env } from "../boundary/components/env/index.tsx";

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

const noEnv = <Env>{};
const noController = (): AbortController => new AbortController();
const noDispatch = <Parameters<ReturnType<typeof consumePending>["run"]>[3]>(
  (() => Promise.resolve())
);

describe("Resource() fetcher invocation", () => {
  it("invokes the fetcher with { env, controller, params, dispatch }", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const controller = noController();

    user();
    const call = consumePending();
    await call.run(noEnv, controller, call.params, noDispatch);

    expect(fetcher).toHaveBeenCalledWith({
      env: noEnv,
      controller,
      params: {},
      dispatch: noDispatch,
    });
  });

  it("forwards the env handle to the fetcher", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ ok: true }));
    const user = Resource(fetcher);
    const env = <Env>{ token: "abc-123" };

    user();
    const call = consumePending();
    await call.run(env, noController(), call.params, noDispatch);

    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ env }));
  });

  it("forwards params and controller to the fetcher", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params }: { params: Params }) =>
      Promise.resolve({ id: params.id }),
    );
    const item = Resource<Env, { id: number }, Params>(fetcher);
    const controller = new AbortController();

    item({ id: 5 });
    const call = consumePending();
    await call.run(noEnv, controller, call.params, noDispatch);

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
      call.run(noEnv, noController(), call.params, noDispatch),
    ).rejects.toThrow("declined");
  });

  it("runs fresh on every call (no in-flight coalescing)", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);

    const runOnce = async () => {
      user();
      const call = consumePending();
      await call.run(noEnv, noController(), call.params, noDispatch);
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
    await first.run(noEnv, noController(), first.params, noDispatch);

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
      first.run(noEnv, noController(), first.params, noDispatch),
    ).rejects.toThrow("boom");

    expect(user()).toBeNull();
    consumePending();
  });

  it("returns null verbatim when the fetcher resolved with null", async () => {
    const user = Resource<Env, string | null>(() => Promise.resolve(null));

    user();
    const first = consumePending();
    await first.run(noEnv, noController(), first.params, noDispatch);

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
    const user = Resource<Env, { id: number; name: string }, Params>(fetcher);

    user({ id: 5 });
    const five = consumePending();
    await five.run(noEnv, noController(), five.params, noDispatch);

    user({ id: 6 });
    const six = consumePending();
    await six.run(noEnv, noController(), six.params, noDispatch);

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
    const user = Resource<Env, { name: string }>(
      (context) =>
        new Promise<{ name: string }>((_resolve, reject) => {
          context.controller.signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    user();
    const call = consumePending();
    const promise = call.run(noEnv, controller, call.params, noDispatch);
    controller.abort();

    await expect(promise).rejects.toThrow("aborted");
  });
});

describe("Resource(fetcher, cache) (shared App cache)", () => {
  it("writes through to the supplied Cache on every successful fetch", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const user = Resource(() => Promise.resolve({ name: "Adam" }), cache);

    user();
    const call = consumePending();
    await call.run(noEnv, noController(), call.params, noDispatch);

    expect([...adapter.entries.keys()].some((k) => k.endsWith(":{}"))).toBe(
      true,
    );
  });

  it("namespaces per-resource so two resources don't collide", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);

    const cat = Resource(() => Promise.resolve({ kind: "cat" }), cache);
    const dog = Resource(() => Promise.resolve({ kind: "dog" }), cache);

    cat();
    const a = consumePending();
    await a.run(noEnv, noController(), a.params, noDispatch);

    dog();
    const b = consumePending();
    await b.run(noEnv, noController(), b.params, noDispatch);

    expect(cat()).toEqual({ kind: "cat" });
    consumePending();
    expect(dog()).toEqual({ kind: "dog" });
    consumePending();
  });

  it("preserves the per-resource namespace key across writes", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const user = Resource(() => Promise.resolve({ name: "Adam" }), cache);

    user();
    const call = consumePending();
    await call.run(noEnv, noController(), call.params, noDispatch);

    const written = [...adapter.entries.keys()];
    expect(written).toHaveLength(1);
    expect(written[0]).toMatch(/^\d+:\{\}$/);
  });

  it("per-params slots are persisted independently", async () => {
    type Params = { id: number };
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<Env, { id: number }, Params>(fetcher, cache);

    item({ id: 5 });
    const five = consumePending();
    await five.run(noEnv, noController(), five.params, noDispatch);

    item({ id: 6 });
    const six = consumePending();
    await six.run(noEnv, noController(), six.params, noDispatch);

    expect(
      [...adapter.entries.keys()].some((k) => k.endsWith(':{"id":5}')),
    ).toBe(true);
    expect(
      [...adapter.entries.keys()].some((k) => k.endsWith(':{"id":6}')),
    ).toBe(true);
  });

  it("falls back to an in-memory Cache when no cache is supplied", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    expect(user()).toBeNull();
    consumePending();

    user();
    const call = consumePending();
    await call.run(noEnv, noController(), call.params, noDispatch);

    expect(user()).toEqual({ name: "Adam" });
    consumePending();
  });
});

describe("evict via PendingCall.evict (chain entry)", () => {
  it("drops the per-params slot via partial-match pattern", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<Env, { id: number }, Params>(fetcher);

    item({ id: 5 });
    const five = consumePending();
    await five.run(noEnv, noController(), five.params, noDispatch);

    item({ id: 6 });
    const six = consumePending();
    await six.run(noEnv, noController(), six.params, noDispatch);

    expect(item({ id: 5 })).toEqual({ id: 5 });
    consumePending();

    item({ id: 5 });
    consumePending().evict({ id: 5 });

    expect(item({ id: 5 })).toBeNull();
    consumePending();
    expect(item({ id: 6 })).toEqual({ id: 6 });
    consumePending();
  });

  it("evicts every slot when called with an empty pattern", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<Env, { id: number }, Params>(fetcher);

    item({ id: 5 });
    const five = consumePending();
    await five.run(noEnv, noController(), five.params, noDispatch);

    item({ id: 6 });
    const six = consumePending();
    await six.run(noEnv, noController(), six.params, noDispatch);

    item();
    consumePending().evict({});

    expect(item({ id: 5 })).toBeNull();
    consumePending();
    expect(item({ id: 6 })).toBeNull();
    consumePending();
  });
});

describe("consumePending() invariants", () => {
  it("throws when called with no pending invocation", () => {
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
    await Promise.resolve();
    expect(() => consumePending()).toThrow();
  });
});
