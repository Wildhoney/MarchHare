import { describe, expect, it, vi } from "vitest";
import { Resource } from "./index.ts";
import { Cache, type Adapter } from "../cache/index.ts";
import type { Env } from "../boundary/components/env/index.tsx";
import type { Dispatch } from "./types.ts";

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
    keys: () => entries.keys(),
  };
}

const noEnv = <Env>{};
const noController = (): AbortController => new AbortController();
const noDispatch = <Dispatch>(() => Promise.resolve());

describe("Resource() fetcher invocation", () => {
  it("invokes the fetcher with { env, controller, params, dispatch }", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const controller = noController();

    const call = user();
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

    const call = user();
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

    const call = item({ id: 5 });
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

    const call = pay();
    await expect(
      call.run(noEnv, noController(), call.params, noDispatch),
    ).rejects.toThrow("declined");
  });

  it("runs fresh on every call (no in-flight coalescing)", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);

    const runOnce = async () => {
      const call = user();
      await call.run(noEnv, noController(), call.params, noDispatch);
    };

    await Promise.all([runOnce(), runOnce(), runOnce()]);

    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe("Resource handle .get(params) sync read", () => {
  it("returns null before any successful fetch", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    expect(user.get()).toBeNull();
  });

  it("returns the cached payload after a successful fetch", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    const first = user();
    await first.run(noEnv, noController(), first.params, noDispatch);

    expect(user.get()).toEqual({ name: "Adam" });
  });

  it("returns null after a failed fetch (cache not poisoned)", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockRejectedValueOnce(new Error("boom"));
    const user = Resource(fetcher);

    const first = user();
    await expect(
      first.run(noEnv, noController(), first.params, noDispatch),
    ).rejects.toThrow("boom");

    expect(user.get()).toBeNull();
  });

  it("returns null verbatim when the fetcher resolved with null", async () => {
    const user = Resource<Env, string | null>(() => Promise.resolve(null));

    const first = user();
    await first.run(noEnv, noController(), first.params, noDispatch);

    expect(user.get()).toBeNull();
    expect(user().read({}).data).toBeNull();
    expect(user().read({}).at).toBeInstanceOf(Temporal.Instant);
  });

  it("keeps separate cache slots for different params", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id, name: `User ${id}` }),
    );
    const user = Resource<Env, { id: number; name: string }, Params>(fetcher);

    const five = user({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    const six = user({ id: 6 });
    await six.run(noEnv, noController(), six.params, noDispatch);

    expect(user.get({ id: 5 })).toEqual({ id: 5, name: "User 5" });
    expect(user.get({ id: 6 })).toEqual({ id: 6, name: "User 6" });
    expect(user.get({ id: 7 })).toBeNull();
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

    const call = user();
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

    const call = user();
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

    const a = cat();
    await a.run(noEnv, noController(), a.params, noDispatch);

    const b = dog();
    await b.run(noEnv, noController(), b.params, noDispatch);

    expect(cat.get()).toEqual({ kind: "cat" });
    expect(dog.get()).toEqual({ kind: "dog" });
  });

  it("preserves the per-resource namespace key across writes", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const user = Resource(() => Promise.resolve({ name: "Adam" }), cache);

    const call = user();
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

    const five = item({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    const six = item({ id: 6 });
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

    expect(user.get()).toBeNull();

    const call = user();
    await call.run(noEnv, noController(), call.params, noDispatch);

    expect(user.get()).toEqual({ name: "Adam" });
  });
});

describe("evict via Invocation.evict (chain entry)", () => {
  it("drops the per-params slot via partial-match pattern", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<Env, { id: number }, Params>(fetcher);

    const five = item({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    const six = item({ id: 6 });
    await six.run(noEnv, noController(), six.params, noDispatch);

    expect(item.get({ id: 5 })).toEqual({ id: 5 });

    item({ id: 5 }).evict({ id: 5 });

    expect(item.get({ id: 5 })).toBeNull();
    expect(item.get({ id: 6 })).toEqual({ id: 6 });
  });

  it("evicts every slot when called with an empty pattern", async () => {
    type Params = { id: number };
    const fetcher = vi.fn(({ params: { id } }: { params: Params }) =>
      Promise.resolve({ id }),
    );
    const item = Resource<Env, { id: number }, Params>(fetcher);

    const five = item({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    const six = item({ id: 6 });
    await six.run(noEnv, noController(), six.params, noDispatch);

    item().evict({});

    expect(item.get({ id: 5 })).toBeNull();
    expect(item.get({ id: 6 })).toBeNull();
  });

  it("evicts persisted entries via the sync adapter", async () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);

    const item = Resource<Env, { name: string }, { id: number }>(
      ({ params }) => Promise.resolve({ name: `User ${params.id}` }),
      cache,
    );

    const call = item({ id: 5 });
    await call.run(noEnv, noController(), call.params, noDispatch);

    expect(adapter.entries.size).toBe(1);
    expect(item.get({ id: 5 })).toEqual({ name: "User 5" });

    item({ id: 5 }).evict({ id: 5 });

    expect(adapter.entries.size).toBe(0);
    expect(item.get({ id: 5 })).toBeNull();
  });
});
