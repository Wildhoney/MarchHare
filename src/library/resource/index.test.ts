import { describe, expect, it, vi } from "vitest";
import { Resource, nuke } from "./index.ts";
import { Cache, type Adapter } from "../cache/index.ts";
import type { Env } from "../boundary/components/env/types.ts";
import { unset } from "../utils/index.ts";
import { getActionSymbol, isBroadcastAction } from "../action/index.ts";
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

    expect(
      [...adapter.entries.keys()].some((cacheKey) => cacheKey.endsWith(":{}")),
    ).toBe(true);
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
    expect(written[0]).toMatch(/^mh:\d+:\{\}$/);
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
      [...adapter.entries.keys()].some((cacheKey) =>
        cacheKey.endsWith(':{"id":5}'),
      ),
    ).toBe(true);
    expect(
      [...adapter.entries.keys()].some((cacheKey) =>
        cacheKey.endsWith(':{"id":6}'),
      ),
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

describe("Cache scope via Cache({key}) prefix on resource keys", () => {
  type AppEnv = { session: { accessToken: string } | null };

  it("prepends the scope prefix to every persisted slot", async () => {
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const user = Resource<AppEnv, { name: string }>(
      () => Promise.resolve({ name: "Adam" }),
      cache,
    );

    const env = <Env>{ session: { accessToken: "alice" } };
    const call = user();
    await call.run(env, noController(), call.params, noDispatch);

    const stored = [...adapter.entries.keys()];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^mh:alice:\d+:\{\}$/);
  });

  it("keeps per-tenant slots independent in the same backing store", async () => {
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const fetcher = vi.fn(({ env }: { env: AppEnv }) =>
      Promise.resolve({ id: env.session?.accessToken ?? "anon" }),
    );
    const user = Resource<AppEnv, { id: string }>(fetcher, cache);

    const alice = <Env>{ session: { accessToken: "alice" } };
    const bob = <Env>{ session: { accessToken: "bob" } };

    const fromAlice = user();
    await fromAlice.run(alice, noController(), fromAlice.params, noDispatch);

    const fromBob = user();
    await fromBob.run(bob, noController(), fromBob.params, noDispatch);

    const stored = [...adapter.entries.keys()].sort();
    expect(stored).toHaveLength(2);
    expect(stored.some((cacheKey) => cacheKey.startsWith("mh:alice:"))).toBe(
      true,
    );
    expect(stored.some((cacheKey) => cacheKey.startsWith("mh:bob:"))).toBe(
      true,
    );
  });

  it("falls back to the unscoped slot when no env getter is wired", async () => {
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const user = Resource<AppEnv, { name: string }>(
      () => Promise.resolve({ name: "Adam" }),
      cache,
    );

    expect(user.get()).toBeNull();

    const env = <Env>{ session: { accessToken: "alice" } };
    const call = user();
    await call.run(env, noController(), call.params, noDispatch);

    expect(user.get()).toBeNull();
  });

  it("sync .get() resolves the env via the App-supplied getter", async () => {
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const env = <Env>{ session: { accessToken: "alice" } };
    const user = Resource<AppEnv, { name: string }>(
      () => Promise.resolve({ name: "Adam" }),
      cache,
      () => env,
    );

    const call = user();
    await call.run(env, noController(), call.params, noDispatch);

    expect(user.get()).toEqual({ name: "Adam" });
  });

  it("evicts within the current scope only", async () => {
    type Params = { id: number };
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const env = <Env>{ session: { accessToken: "alice" } };
    const item = Resource<AppEnv, { id: number }, Params>(
      ({ params }) => Promise.resolve({ id: params.id }),
      cache,
      () => env,
    );

    const five = item({ id: 5 });
    await five.run(env, noController(), five.params, noDispatch);

    const bob = <Env>{ session: { accessToken: "bob" } };
    const sixForBob = item({ id: 6 });
    await sixForBob.run(bob, noController(), sixForBob.params, noDispatch);

    expect([...adapter.entries.keys()].sort()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^mh:alice:\d+:\{"id":5\}$/),
        expect.stringMatching(/^mh:bob:\d+:\{"id":6\}$/),
      ]),
    );

    item({ id: 5 }).evict({ id: 5 });

    expect(
      [...adapter.entries.keys()].some((cacheKey) =>
        cacheKey.startsWith("mh:alice:"),
      ),
    ).toBe(false);
    expect(
      [...adapter.entries.keys()].some((cacheKey) =>
        cacheKey.startsWith("mh:bob:"),
      ),
    ).toBe(true);
  });

  it("keeps the per-resource namespace inside the scope so two resources don't collide", async () => {
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });

    const cat = Resource<AppEnv, { kind: "cat" }>(
      () => Promise.resolve({ kind: "cat" }),
      cache,
    );
    const dog = Resource<AppEnv, { kind: "dog" }>(
      () => Promise.resolve({ kind: "dog" }),
      cache,
    );

    const env = <Env>{ session: { accessToken: "alice" } };
    const catCall = cat();
    await catCall.run(env, noController(), catCall.params, noDispatch);
    const dogCall = dog();
    await dogCall.run(env, noController(), dogCall.params, noDispatch);

    const stored = [...adapter.entries.keys()].sort();
    expect(stored).toHaveLength(2);
    stored.forEach((cacheKey) =>
      expect(cacheKey).toMatch(/^mh:alice:\d+:\{\}$/),
    );
    expect(new Set(stored).size).toBe(2);
  });

  it("'.exceeds(...)' freshness window is per-scope, not global", async () => {
    const adapter = memoryAdapter();
    const live: { env: Env } = {
      env: <Env>{ session: { accessToken: "alice" } },
    };
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const fetcher = vi.fn(({ env }: { env: AppEnv }) =>
      Promise.resolve({ id: env.session?.accessToken ?? "anon" }),
    );
    const user = Resource<AppEnv, { id: string }>(
      fetcher,
      cache,
      () => live.env,
    );

    const aliceCall = user();
    await aliceCall.run(live.env, noController(), aliceCall.params, noDispatch);
    expect(user.get()).toEqual({ id: "alice" });

    live.env = <Env>{ session: { accessToken: "bob" } };
    expect(user.get()).toBeNull();

    const bobCall = user();
    expect(bobCall.read(bobCall.params).data).toBe(unset);
  });

  it("env mutation between writes routes each payload to its own scope", async () => {
    const adapter = memoryAdapter();
    const live: { env: Env } = {
      env: <Env>{ session: { accessToken: "alice" } },
    };
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const user = Resource<AppEnv, { name: string }>(
      ({ env }) =>
        Promise.resolve({ name: env.session?.accessToken ?? "anon" }),
      cache,
      () => live.env,
    );

    const aliceFetch = user();
    await aliceFetch.run(
      live.env,
      noController(),
      aliceFetch.params,
      noDispatch,
    );

    live.env = <Env>{ session: { accessToken: "bob" } };
    const bobFetch = user();
    await bobFetch.run(live.env, noController(), bobFetch.params, noDispatch);

    live.env = <Env>{ session: { accessToken: "alice" } };
    expect(user.get()).toEqual({ name: "alice" });

    live.env = <Env>{ session: { accessToken: "bob" } };
    expect(user.get()).toEqual({ name: "bob" });

    expect(adapter.entries.size).toBe(2);
  });

  it("'nuke({...})' respects the active scope when partial-matching", async () => {
    type Params = { id: number };
    const adapter = memoryAdapter();
    const live: { env: Env } = {
      env: <Env>{ session: { accessToken: "alice" } },
    };
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const item = Resource<AppEnv, { id: number }, Params>(
      ({ params }) => Promise.resolve({ id: params.id }),
      cache,
      () => live.env,
    );

    const fiveAsAlice = item({ id: 5 });
    await fiveAsAlice.run(
      live.env,
      noController(),
      fiveAsAlice.params,
      noDispatch,
    );

    live.env = <Env>{ session: { accessToken: "bob" } };
    const fiveAsBob = item({ id: 5 });
    await fiveAsBob.run(live.env, noController(), fiveAsBob.params, noDispatch);

    expect(adapter.entries.size).toBe(2);

    nuke({ id: 5 });

    expect(
      [...adapter.entries.keys()].some((cacheKey) =>
        cacheKey.startsWith("mh:alice:"),
      ),
    ).toBe(true);
    expect(
      [...adapter.entries.keys()].some((cacheKey) =>
        cacheKey.startsWith("mh:bob:"),
      ),
    ).toBe(false);
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

    item({ id: 5 }).evict({});

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

describe("Resource.action auto-broadcast", () => {
  it("exposes a broadcast action on the handle", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    expect(user.action).toBeDefined();
    expect(typeof user.action).toBe("function");
    const symbol = getActionSymbol(user.action());
    expect(typeof symbol).toBe("symbol");
    expect(isBroadcastAction(user.action())).toBe(true);
  });

  it("mints a distinct action symbol per Resource declaration", () => {
    const userA = Resource(() => Promise.resolve({ id: 1 }));
    const userB = Resource(() => Promise.resolve({ id: 2 }));

    expect(getActionSymbol(userA.action())).not.toBe(
      getActionSymbol(userB.action()),
    );
  });

  it("rejects channel keys not declared on the resource's params", () => {
    type Params = { teamId: number; userId: number };
    const member = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.userId }),
    );

    member.action({ teamId: 42 });
    member.action({ teamId: 42, userId: 7 });

    // @ts-expect-error — `tenantId` is not in Params.
    member.action({ tenantId: 1 });
    // @ts-expect-error — `teamId` is on Params but `tenantId` is not.
    member.action({ teamId: 42, tenantId: 1 });
  });

  it("rejects any channel argument on a params-less resource", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    user.action();
    user.action({});

    // @ts-expect-error — params-less resources accept no channel keys.
    user.action({ blah: "Adam" });
  });

  it("rejects extra keys passed to .get() for a params-less resource", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    user.get();
    user.get({});

    // @ts-expect-error — params-less resources accept no get keys.
    user.get({ blah: "Adam" });
  });

  it("rejects extra keys passed to .get() for a parametric resource", () => {
    type Params = { id: number };
    const item = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    item.get({ id: 5 });

    // @ts-expect-error — `slug` is not in Params.
    item.get({ id: 5, slug: "x" });
  });

  it("dispatches the action with the resolved payload after a successful fetch", async () => {
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    const call = user();
    await call.run(noEnv, noController(), call.params, dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const [dispatched, payload] = <[unknown, unknown]>dispatch.mock.calls[0];
    expect(getActionSymbol(<never>dispatched)).toBe(
      getActionSymbol(user.action()),
    );
    expect(payload).toEqual({ name: "Adam" });
  });

  it("dispatches with a channel mirroring the call params", async () => {
    type Params = { id: number; orgId: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const user = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    const call = user({ id: 5, orgId: 42 });
    await call.run(noEnv, noController(), call.params, dispatch);

    const [action] = <[unknown]>dispatch.mock.calls[0];
    expect((<{ channel: Params }>action).channel).toEqual({
      id: 5,
      orgId: 42,
    });
  });

  it("dispatches an empty channel when the Resource has no params", async () => {
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    const call = user();
    await call.run(noEnv, noController(), call.params, dispatch);

    const [action] = <[unknown]>dispatch.mock.calls[0];
    expect((<{ channel: object }>action).channel).toEqual({});
  });

  it("does not dispatch when the fetch rejects", async () => {
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const user = Resource(() => Promise.reject(new Error("nope")));

    const call = user();
    await expect(
      call.run(noEnv, noController(), call.params, dispatch),
    ).rejects.toThrow("nope");

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches one action per fetch when called concurrently with different params", async () => {
    type Params = { id: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const item = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    const five = item({ id: 5 });
    const six = item({ id: 6 });
    await Promise.all([
      five.run(noEnv, noController(), five.params, dispatch),
      six.run(noEnv, noController(), six.params, dispatch),
    ]);

    expect(dispatch).toHaveBeenCalledTimes(2);
    const channels = dispatch.mock.calls.map(
      (call) => (<{ channel: Params }>call[0]).channel,
    );
    expect(channels).toContainEqual({ id: 5 });
    expect(channels).toContainEqual({ id: 6 });
  });

  it("dispatches after the cache write so subscribers see the warm cache", async () => {
    const adapter = memoryAdapter();
    const cache = Cache({ ...adapter });
    type Params = { id: number };

    let cachedAtDispatch: { name: string } | null = null;
    const item = Resource<Env, { name: string }, Params>(
      ({ params }) => Promise.resolve({ name: `User ${params.id}` }),
      cache,
    );
    const dispatch = vi.fn((..._args: unknown[]) => {
      cachedAtDispatch = item.get({ id: 5 });
      return Promise.resolve();
    });

    const call = item({ id: 5 });
    await call.run(noEnv, noController(), call.params, dispatch);

    expect(cachedAtDispatch).toEqual({ name: "User 5" });
  });
});

describe("Resource.action eviction broadcast", () => {
  it("dispatches null with the evicted params as the channel when Invocation.evict is called with a dispatch", async () => {
    type Params = { id: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const item = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    const five = item({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    dispatch.mockClear();
    item({ id: 5 }).evict({ id: 5 }, <Dispatch>dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const [dispatched, payload] = <[unknown, unknown]>dispatch.mock.calls[0];
    expect(getActionSymbol(<never>dispatched)).toBe(
      getActionSymbol(item.action()),
    );
    expect((<{ channel: Params }>dispatched).channel).toEqual({ id: 5 });
    expect(payload).toBeNull();
  });

  it("does not dispatch when Invocation.evict is called without a dispatch (module-scope call)", async () => {
    type Params = { id: number };
    const item = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    const five = item({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    expect(() => item({ id: 5 }).evict({ id: 5 })).not.toThrow();
    expect(item.get({ id: 5 })).toBeNull();
  });

  it("fires one null broadcast per evicted slot when the pattern matches multiple slots", async () => {
    type Params = { id: number; tenantId: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const item = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    const alice = item({ id: 1, tenantId: 42 });
    const bob = item({ id: 2, tenantId: 42 });
    const carol = item({ id: 3, tenantId: 99 });
    await alice.run(noEnv, noController(), alice.params, noDispatch);
    await bob.run(noEnv, noController(), bob.params, noDispatch);
    await carol.run(noEnv, noController(), carol.params, noDispatch);

    dispatch.mockClear();
    item({ id: 1, tenantId: 42 }).evict({ tenantId: 42 }, <Dispatch>dispatch);

    expect(dispatch).toHaveBeenCalledTimes(2);
    const channels = dispatch.mock.calls.map(
      (call) => (<{ channel: Params }>call[0]).channel,
    );
    expect(channels).toContainEqual({ id: 1, tenantId: 42 });
    expect(channels).toContainEqual({ id: 2, tenantId: 42 });
    expect(channels).not.toContainEqual({ id: 3, tenantId: 99 });
    for (const [, payload] of dispatch.mock.calls) {
      expect(payload).toBeNull();
    }
    expect(item.get({ id: 3, tenantId: 99 })).toEqual({ id: 3 });
  });

  it("does not dispatch when the pattern matches no cache slot", async () => {
    type Params = { id: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const item = Resource<Env, { id: number }, Params>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );

    const five = item({ id: 5 });
    await five.run(noEnv, noController(), five.params, noDispatch);

    dispatch.mockClear();
    item({ id: 5 }).evict({ id: 999 }, <Dispatch>dispatch);

    expect(dispatch).not.toHaveBeenCalled();
    expect(item.get({ id: 5 })).toEqual({ id: 5 });
  });

  it("fires null broadcasts across every Resource when nuke is called with a dispatch", async () => {
    type CatParams = { id: number; marker: "nuke-cross-resource" };
    type DogParams = { name: string; marker: "nuke-cross-resource" };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const cat = Resource<Env, { id: number }, CatParams>(({ params }) =>
      Promise.resolve({ id: params.id }),
    );
    const dog = Resource<Env, { name: string }, DogParams>(({ params }) =>
      Promise.resolve({ name: params.name }),
    );

    const kitty = cat({ id: 7, marker: "nuke-cross-resource" });
    const rex = dog({ name: "rex", marker: "nuke-cross-resource" });
    await kitty.run(noEnv, noController(), kitty.params, noDispatch);
    await rex.run(noEnv, noController(), rex.params, noDispatch);

    dispatch.mockClear();
    nuke({ marker: "nuke-cross-resource" }, <Dispatch>dispatch);

    const catSymbol = getActionSymbol(cat.action());
    const dogSymbol = getActionSymbol(dog.action());
    const dispatched = dispatch.mock.calls.map((call) =>
      getActionSymbol(<never>call[0]),
    );
    expect(dispatched).toContain(catSymbol);
    expect(dispatched).toContain(dogSymbol);
    for (const [, payload] of dispatch.mock.calls) {
      expect(payload).toBeNull();
    }
  });

  it("scopes eviction dispatches to the current scope (does not fire for other-scope slots)", async () => {
    type Params = { id: number };
    type AppEnv = { session: { accessToken: string } | null };
    const adapter = memoryAdapter();
    const cache = Cache<AppEnv>({
      ...adapter,
      key: ({ env }) => env.session?.accessToken ?? "",
    });
    const alice = <Env>{ session: { accessToken: "alice" } };
    const bob = <Env>{ session: { accessToken: "bob" } };
    let currentEnv: Env = alice;
    const item = Resource<AppEnv, { id: number }, Params>(
      ({ params }) => Promise.resolve({ id: params.id }),
      cache,
      () => currentEnv,
    );

    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());

    const forAlice = item({ id: 1 });
    await forAlice.run(alice, noController(), forAlice.params, noDispatch);
    const forBob = item({ id: 1 });
    await forBob.run(bob, noController(), forBob.params, noDispatch);

    dispatch.mockClear();
    currentEnv = alice;
    item({ id: 1 }).evict({ id: 1 }, <Dispatch>dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    currentEnv = bob;
    expect(item.get({ id: 1 })).toEqual({ id: 1 });
  });
});

describe("Resource() without a fetcher (local resource)", () => {
  it("returns null from .get() before any set", () => {
    const draft = Resource<Env, { text: string }>();
    expect(draft.get()).toBeNull();
  });

  it("exposes no run on the invocation", () => {
    const draft = Resource<Env, { text: string }>();
    const call = draft();

    expect(
      // @ts-expect-error — local invocations carry no fetcher to run.
      call.run,
    ).toBeUndefined();
  });

  it("writes the slot via Invocation.write and reads it back synchronously", () => {
    const draft = Resource<Env, { text: string }>();
    const call = draft();

    call.write(noEnv, call.params, { text: "hello" }, noDispatch);

    expect(draft.get()).toEqual({ text: "hello" });
  });

  it("keeps separate cache slots for different params", () => {
    type Params = { id: number };
    const draft = Resource<Env, { text: string }, Params>();

    const first = draft({ id: 1 });
    first.write(noEnv, first.params, { text: "one" }, noDispatch);
    const second = draft({ id: 2 });
    second.write(noEnv, second.params, { text: "two" }, noDispatch);

    expect(draft.get({ id: 1 })).toEqual({ text: "one" });
    expect(draft.get({ id: 2 })).toEqual({ text: "two" });
  });

  it("dispatches the auto-broadcast with the written value and the params as the channel", () => {
    type Params = { id: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const draft = Resource<Env, { text: string }, Params>();

    const call = draft({ id: 5 });
    call.write(noEnv, call.params, { text: "hello" }, <Dispatch>dispatch);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const [dispatched, payload] = <[unknown, unknown]>dispatch.mock.calls[0];
    expect(getActionSymbol(<never>dispatched)).toBe(
      getActionSymbol(draft.action()),
    );
    expect((<{ channel: Params }>dispatched).channel).toEqual({ id: 5 });
    expect(payload).toEqual({ text: "hello" });
  });

  it("dispatches the write broadcast after the cache write so subscribers see the warm cache", () => {
    const draft = Resource<Env, { text: string }>();
    const seen: Array<{ text: string } | null> = [];
    const dispatch = <Dispatch>((..._args: unknown[]) => {
      seen.push(draft.get());
      return Promise.resolve();
    });

    const call = draft();
    call.write(noEnv, call.params, { text: "hello" }, dispatch);

    expect(seen).toEqual([{ text: "hello" }]);
  });

  it("evicts the slot and broadcasts null with the stored params as the channel", () => {
    type Params = { id: number };
    const dispatch = vi.fn((..._args: unknown[]) => Promise.resolve());
    const draft = Resource<Env, { text: string }, Params>();

    const call = draft({ id: 5 });
    call.write(noEnv, call.params, { text: "hello" }, noDispatch);
    call.evict({ id: 5 }, <Dispatch>dispatch);

    expect(draft.get({ id: 5 })).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [dispatched, payload] = <[unknown, unknown]>dispatch.mock.calls[0];
    expect((<{ channel: Params }>dispatched).channel).toEqual({ id: 5 });
    expect(payload).toBeNull();
  });

  it("nuke() drops local slots alongside fetched ones", async () => {
    type Params = { marker: "nuke-local" };
    const draft = Resource<Env, { text: string }, Params>();
    const user = Resource<Env, { name: string }, Params>(() =>
      Promise.resolve({ name: "Adam" }),
    );

    const local = draft({ marker: "nuke-local" });
    local.write(noEnv, local.params, { text: "hello" }, noDispatch);
    const fetched = user({ marker: "nuke-local" });
    await fetched.run(noEnv, noController(), fetched.params, noDispatch);

    nuke({ marker: "nuke-local" });

    expect(draft.get({ marker: "nuke-local" })).toBeNull();
    expect(user.get({ marker: "nuke-local" })).toBeNull();
  });

  it("writes through to a supplied Cache with a per-resource namespace", () => {
    const adapter = memoryAdapter();
    const cache = Cache(adapter);
    const draftA = Resource<Env, { text: string }>(undefined, cache);
    const draftB = Resource<Env, { text: string }>(undefined, cache);

    const callA = draftA();
    callA.write(noEnv, callA.params, { text: "A" }, noDispatch);
    const callB = draftB();
    callB.write(noEnv, callB.params, { text: "B" }, noDispatch);

    expect(adapter.entries.size).toBe(2);
    expect(draftA.get()).toEqual({ text: "A" });
    expect(draftB.get()).toEqual({ text: "B" });
  });

  it("rejects channel keys not declared on the params", () => {
    type Params = { id: number };
    const draft = Resource<Env, { text: string }, Params>();

    draft.action({ id: 5 });

    // @ts-expect-error — `slug` is not in Params.
    draft.action({ slug: "x" });
  });
});
