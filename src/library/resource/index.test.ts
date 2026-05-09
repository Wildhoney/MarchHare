import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import * as React from "react";
import ms from "ms";
import { Resource } from "./index.ts";
import {
  Context,
  BroadcastEmitter,
} from "../boundary/components/broadcast/utils.ts";
import { Action, Distribution, useActions } from "../index.ts";
import { getActionSymbol } from "../action/index.ts";

describe("Resource()", () => {
  it("declares a handle with a key", () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    expect(user.key).toBe("user");
  });
});

describe("actions.useResource()", () => {
  it("fetches on first call and resolves with the data", async () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.fetch()).resolves.toEqual({ name: "Adam" });
  });

  it("fetches fresh on every awaited call (no stale cache)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.fetch()).resolves.toEqual({ name: "Adam" });
    await expect(result.current.fetch()).resolves.toEqual({ name: "Eve" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent calls into a single in-flight fetch", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    const [a, b, c] = await Promise.all([
      result.current.fetch(),
      result.current.fetch(),
      result.current.fetch(),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ name: "Adam" });
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("clears in-flight state on rejection so the next call retries", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ name: "Adam" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.fetch()).rejects.toThrow("boom");
    await expect(result.current.fetch()).resolves.toEqual({ name: "Adam" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("two components using the same resource share the in-flight fetch", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);

    const a = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });
    const b = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await Promise.all([a.result.current.fetch(), b.result.current.fetch()]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("onSuccess receives a context with response, data, dispatch", async () => {
    const onSuccess = vi.fn();
    const user = Resource(
      "user",
      () => Promise.resolve({ name: "Adam" }),
      onSuccess,
    );
    const { result } = renderHook(() => {
      const actions = useActions<void, void, { hint: string }>(() => ({
        hint: "hello",
      }));
      return actions.useResource(user);
    });

    await result.current.fetch();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const [context] = onSuccess.mock.calls[0];
    expect(context.response).toEqual({ name: "Adam" });
    expect(context.data.hint).toBe("hello");
    expect(typeof context.dispatch).toBe("function");
  });

  it("onError receives a context with error, data, dispatch", async () => {
    const onError = vi.fn();
    const error = new Error("boom");
    const user = Resource(
      "user",
      () => Promise.reject(error),
      undefined,
      onError,
    );
    const { result } = renderHook(() => {
      const actions = useActions<void, void, { hint: string }>(() => ({
        hint: "hello",
      }));
      return actions.useResource(user);
    });

    await expect(result.current.fetch()).rejects.toBe(error);

    expect(onError).toHaveBeenCalledTimes(1);
    const [context] = onError.mock.calls[0];
    expect(context.error).toBe(error);
    expect(context.data.hint).toBe("hello");
    expect(typeof context.dispatch).toBe("function");
  });

  it("onError narrows to the typed error generic", async () => {
    class HttpError extends Error {
      constructor(public status: number) {
        super(`HTTP ${status}`);
      }
    }
    class RateLimitedError extends HttpError {
      constructor(public retryAfter: number) {
        super(429);
      }
    }
    type ApiError = HttpError | RateLimitedError;

    const seen = vi.fn<(context: { error: ApiError }) => void>();
    const user = Resource<{ name: string }, ApiError>(
      "user",
      () => Promise.reject(new RateLimitedError(30)),
      undefined,
      seen,
    );
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.fetch()).rejects.toBeInstanceOf(
      RateLimitedError,
    );

    const error = seen.mock.calls[0][0].error;
    expect(error).toBeInstanceOf(RateLimitedError);
    if (error instanceof RateLimitedError) {
      expect(error.retryAfter).toBe(30);
    }
  });

  it("forwards args to the fetcher", async () => {
    const fetcher = vi.fn((cursor: string | null) =>
      Promise.resolve({ items: [cursor ?? "first"] }),
    );
    const feed = Resource("feed", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    await expect(result.current.fetch(null)).resolves.toEqual({
      items: ["first"],
    });
    await expect(result.current.fetch("abc")).resolves.toEqual({
      items: ["abc"],
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, null);
    expect(fetcher).toHaveBeenNthCalledWith(2, "abc");
  });

  it("dedupes concurrent calls per arg-tuple, not globally", async () => {
    const fetcher = vi.fn((cursor: string | null) =>
      Promise.resolve({ items: [cursor ?? "first"] }),
    );
    const feed = Resource("feed", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    // Concurrent calls with same arg: one fetch
    const [a, b] = await Promise.all([
      result.current.fetch(null),
      result.current.fetch(null),
    ]);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Concurrent calls with different args: two fetches
    const [c, d] = await Promise.all([
      result.current.fetch("x"),
      result.current.fetch("y"),
    ]);
    expect(c).not.toBe(d);
    expect(fetcher).toHaveBeenCalledTimes(3); // 1 (null) + 2 (x, y)
  });

  it("auto-injected dispatch broadcasts onSuccess via the boundary's emitter", async () => {
    const Updated = Action<string>("Updated", Distribution.Broadcast);
    const emitter = new BroadcastEmitter();
    const listener = vi.fn();
    emitter.on(getActionSymbol(Updated), listener);

    const user = Resource(
      "user",
      () => Promise.resolve({ name: "Adam" }),
      ({ dispatch }) => dispatch(Updated, "hello"),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Context.Provider, { value: emitter }, children);

    const { result } = renderHook(
      () => {
        const actions = useActions();
        return actions.useResource(user);
      },
      { wrapper },
    );

    await result.current.fetch();

    expect(listener.mock.calls[0][0]).toBe("hello");
  });

  it("auto-injected dispatch broadcasts onError via the boundary's emitter", async () => {
    const Failed = Action<string>("Failed", Distribution.Broadcast);
    const emitter = new BroadcastEmitter();
    const listener = vi.fn();
    emitter.on(getActionSymbol(Failed), listener);

    const error = new Error("boom");
    const user = Resource(
      "user",
      () => Promise.reject(error),
      undefined,
      ({ dispatch }) => dispatch(Failed, "uh oh"),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Context.Provider, { value: emitter }, children);

    const { result } = renderHook(
      () => {
        const actions = useActions();
        return actions.useResource(user);
      },
      { wrapper },
    );

    await expect(result.current.fetch()).rejects.toBe(error);

    expect(listener.mock.calls[0][0]).toBe("uh oh");
  });
});

describe("ResourceHandle.cache / .fetched", () => {
  it("are null before any fetch resolves", () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    expect(result.current.cache).toBeNull();
    expect(result.current.fetched).toBeNull();
  });

  it("populate after a successful fetch", async () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    const before = Date.now();
    await result.current.fetch();
    const after = Date.now();

    const fetched = result.current.fetched;
    if (!fetched) throw new Error("expected fetched to be set");
    expect(result.current.cache).toEqual({ name: "Adam" });
    expect(fetched).toBeInstanceOf(Date);
    expect(fetched.getTime()).toBeGreaterThanOrEqual(before);
    expect(fetched.getTime()).toBeLessThanOrEqual(after);
  });

  it("update to the most recent successful response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.fetch();
    const firstFetched = result.current.fetched;
    if (!firstFetched) throw new Error("expected fetched to be set");
    expect(result.current.cache).toEqual({ name: "Adam" });

    await new Promise((resolve) => setTimeout(resolve, 2));
    await result.current.fetch();

    const secondFetched = result.current.fetched;
    if (!secondFetched) throw new Error("expected fetched to still be set");
    expect(result.current.cache).toEqual({ name: "Eve" });
    expect(secondFetched.getTime()).toBeGreaterThan(firstFetched.getTime());
  });

  it("are not updated by a failed fetch", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockRejectedValueOnce(new Error("boom"));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.fetch();
    const fetchedAfterSuccess = result.current.fetched;

    await expect(result.current.fetch()).rejects.toThrow("boom");

    expect(result.current.cache).toEqual({ name: "Adam" });
    expect(result.current.fetched).toBe(fetchedAfterSuccess);
  });

  it("are shared across components using the same Resource", async () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));

    const a = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });
    const b = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await a.result.current.fetch();

    expect(b.result.current.cache).toEqual({ name: "Adam" });
    expect(b.result.current.fetched).toBeInstanceOf(Date);
  });
});

describe("fetch.unless({ within })", () => {
  it("fetches when no successful fetch has happened yet", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(
      result.current.fetch.unless({ within: ms("5m") }),
    ).resolves.toEqual({ name: "Adam" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns the cached value without fetching when within the window", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.fetch();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await expect(
      result.current.fetch.unless({ within: ms("5m") }),
    ).resolves.toEqual({ name: "Adam" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fetches when the cache is older than the window", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.fetch();

    vi.useFakeTimers({ now: Date.now() + ms("6m") });
    try {
      await expect(
        result.current.fetch.unless({ within: ms("5m") }),
      ).resolves.toEqual({ name: "Eve" });
    } finally {
      vi.useRealTimers();
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("forwards args to the underlying fetcher when it falls through", async () => {
    const fetcher = vi.fn((cursor: string | null) =>
      Promise.resolve({ items: [cursor ?? "first"] }),
    );
    const feed = Resource("feed", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    await expect(
      result.current.fetch.unless({ within: ms("5m") }, "abc"),
    ).resolves.toEqual({ items: ["abc"] });
    expect(fetcher).toHaveBeenCalledWith("abc");
  });
});
