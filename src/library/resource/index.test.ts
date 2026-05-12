import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { Resource } from "./index.ts";
import { useActions } from "../index.ts";

describe("Resource()", () => {
  it("declares a handle with a key", () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    expect(user.key).toBe("user");
  });

  it("returns a frozen handle — props cannot be reassigned", () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    expect(Object.isFrozen(user)).toBe(true);
    expect(() => {
      (<{ key: unknown }>user).key = "other";
    }).toThrow(TypeError);
  });
});

describe("actions.useResource()", () => {
  it("runs on first call and resolves with the data", async () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.run()).resolves.toEqual({ name: "Adam" });
  });

  it("runs fresh on every awaited call (no stale data)", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.run()).resolves.toEqual({ name: "Adam" });
    await expect(result.current.run()).resolves.toEqual({ name: "Eve" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent calls into a single in-flight run", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    const [a, b, c] = await Promise.all([
      result.current.run(),
      result.current.run(),
      result.current.run(),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ name: "Adam" });
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("clears in-flight state on rejection so the next call retries", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ name: "Adam" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.run()).rejects.toThrow("boom");
    await expect(result.current.run()).resolves.toEqual({ name: "Adam" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("two components using the same resource share the in-flight run", async () => {
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

    await Promise.all([a.result.current.run(), b.result.current.run()]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("forwards params to the fetcher", async () => {
    type Params = { cursor: string | null };
    const fetcher = vi.fn((params: Params) =>
      Promise.resolve({ items: [params.cursor ?? "first"] }),
    );
    const feed = Resource<{ items: string[] }, Params>("feed", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    await expect(result.current.run({ cursor: null })).resolves.toEqual({
      items: ["first"],
    });
    await expect(result.current.run({ cursor: "abc" })).resolves.toEqual({
      items: ["abc"],
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, { cursor: null });
    expect(fetcher).toHaveBeenNthCalledWith(2, { cursor: "abc" });
  });

  it("dedupes concurrent calls per param-set, not globally", async () => {
    type Params = { cursor: string | null };
    const fetcher = vi.fn((params: Params) =>
      Promise.resolve({ items: [params.cursor ?? "first"] }),
    );
    const feed = Resource<{ items: string[] }, Params>("feed", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    const [a, b] = await Promise.all([
      result.current.run({ cursor: null }),
      result.current.run({ cursor: null }),
    ]);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);

    const [c, d] = await Promise.all([
      result.current.run({ cursor: "x" }),
      result.current.run({ cursor: "y" }),
    ]);
    expect(c).not.toBe(d);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("awaiting run() does not resolve before the fetcher promise settles", async () => {
    const order: string[] = [];
    const user = Resource("user", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("fetcher resolved");
      return { name: "Adam" };
    });

    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.run();
    order.push("after run");

    expect(order).toEqual(["fetcher resolved", "after run"]);
  });
});

describe("ResourceHandle.data / .at", () => {
  it("are null before any run resolves", () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.at).toBeNull();
  });

  it("populate after a successful run", async () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    const before = Temporal.Now.instant();
    await result.current.run();
    const after = Temporal.Now.instant();

    const at = result.current.at;
    if (!at) throw new Error("expected at to be set");
    expect(result.current.data).toEqual({ name: "Adam" });
    expect(at).toBeInstanceOf(Temporal.Instant);
    expect(Temporal.Instant.compare(at, before)).toBeGreaterThanOrEqual(0);
    expect(Temporal.Instant.compare(at, after)).toBeLessThanOrEqual(0);
  });

  it("update to the most recent successful data", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.run();
    const firstAt = result.current.at;
    if (!firstAt) throw new Error("expected at to be set");
    expect(result.current.data).toEqual({ name: "Adam" });

    await new Promise((resolve) => setTimeout(resolve, 2));
    await result.current.run();

    const secondAt = result.current.at;
    if (!secondAt) throw new Error("expected at to still be set");
    expect(result.current.data).toEqual({ name: "Eve" });
    expect(Temporal.Instant.compare(secondAt, firstAt)).toBeGreaterThan(0);
  });

  it("are not updated by a failed run", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockRejectedValueOnce(new Error("boom"));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.run();
    const atAfterSuccess = result.current.at;

    await expect(result.current.run()).rejects.toThrow("boom");

    expect(result.current.data).toEqual({ name: "Adam" });
    expect(result.current.at).toBe(atAfterSuccess);
  });

  it("returns a frozen object — props cannot be reassigned", () => {
    const user = Resource("user", () => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    expect(Object.isFrozen(result.current)).toBe(true);
    expect(() => {
      (<{ run: unknown }>result.current).run = () => Promise.resolve(null);
    }).toThrow(TypeError);
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

    await a.result.current.run();

    expect(b.result.current.data).toEqual({ name: "Adam" });
    expect(b.result.current.at).toBeInstanceOf(Temporal.Instant);
  });
});

describe("run.if({ over })", () => {
  it("runs when no successful run has happened yet", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(
      result.current.run.if({ over: { minutes: 5 } }),
    ).resolves.toEqual({ name: "Adam" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns the cached data without running when inside the window", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.run();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await expect(
      result.current.run.if({ over: { minutes: 5 } }),
    ).resolves.toEqual({ name: "Adam" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("runs when the cached data is older than the window", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.run();

    vi.useFakeTimers({ now: Date.now() + 6 * 60_000 });
    try {
      await expect(
        result.current.run.if({ over: { minutes: 5 } }),
      ).resolves.toEqual({ name: "Eve" });
    } finally {
      vi.useRealTimers();
    }
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("forwards params to the underlying fetcher when it falls through", async () => {
    type Params = { cursor: string | null };
    const fetcher = vi.fn((params: Params) =>
      Promise.resolve({ items: [params.cursor ?? "first"] }),
    );
    const feed = Resource<{ items: string[] }, Params>("feed", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    await expect(
      result.current.run.if({ over: { minutes: 5 } }, { cursor: "abc" }),
    ).resolves.toEqual({ items: ["abc"] });
    expect(fetcher).toHaveBeenCalledWith({ cursor: "abc" });
  });

  it("accepts an ISO 8601 duration string for over", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource("user", fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current.run();
    await result.current.run.if({ over: "PT5M" });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
