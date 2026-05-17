import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { Resource } from "./index.ts";
import { useActions } from "../index.ts";

describe("Resource() — invoking", () => {
  it("runs on first call and resolves with the data", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current()).resolves.toEqual({ name: "Adam" });
  });

  it("runs fresh on every awaited call (no stale data)", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current()).resolves.toEqual({ name: "Adam" });
    await expect(result.current()).resolves.toEqual({ name: "Eve" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fires every concurrent call independently — no in-flight coalescing", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await Promise.all([result.current(), result.current(), result.current()]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("forwards params to the fetcher", async () => {
    type Params = { cursor: string | null };
    const fetcher = vi.fn((params: Params) =>
      Promise.resolve({ items: [params.cursor ?? "first"] }),
    );
    const feed = Resource<{ items: string[] }, Params>(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    await expect(result.current({ cursor: null })).resolves.toEqual({
      items: ["first"],
    });
    await expect(result.current({ cursor: "abc" })).resolves.toEqual({
      items: ["abc"],
    });

    expect(fetcher).toHaveBeenNthCalledWith(1, { cursor: null });
    expect(fetcher).toHaveBeenNthCalledWith(2, { cursor: "abc" });
  });

  it("awaiting () does not resolve before the fetcher promise settles", async () => {
    const order: string[] = [];
    const user = Resource(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push("fetcher resolved");
      return { name: "Adam" };
    });

    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current();
    order.push("after run");

    expect(order).toEqual(["fetcher resolved", "after run"]);
  });

  it("propagates errors from the fetcher", async () => {
    const pay = Resource(() => Promise.reject(new Error("declined")));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(pay);
    });

    await expect(result.current()).rejects.toThrow("declined");
  });
});

describe(".else(fallback)", () => {
  it("returns the fallback before any successful run", () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    expect(result.current.else(null)).toBeNull();
    expect(result.current.else({ name: "default" })).toEqual({
      name: "default",
    });
  });

  it("returns the cached payload after a successful run", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current();
    expect(result.current.else(null)).toEqual({ name: "Adam" });
  });

  it("retains the cached payload after a subsequent failure", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockRejectedValueOnce(new Error("boom"));
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current();
    await expect(result.current()).rejects.toThrow("boom");

    expect(result.current.else(null)).toEqual({ name: "Adam" });
  });

  it("is shared across components using the same Resource", async () => {
    const user = Resource(() => Promise.resolve({ name: "Adam" }));

    const a = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });
    const b = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await a.result.current();

    expect(b.result.current.else(null)).toEqual({ name: "Adam" });
  });
});

describe(".if({ over })", () => {
  it("runs when no successful run has happened yet", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await expect(result.current.if({ over: { minutes: 5 } })).resolves.toEqual({
      name: "Adam",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns the cached data without running when inside the window", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current();
    expect(fetcher).toHaveBeenCalledTimes(1);

    await expect(result.current.if({ over: { minutes: 5 } })).resolves.toEqual({
      name: "Adam",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("runs when the cached data is older than the window", async () => {
    const fetcher = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: "Adam" })
      .mockResolvedValueOnce({ name: "Eve" });
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current();

    vi.useFakeTimers({ now: Date.now() + 6 * 60_000 });
    try {
      await expect(
        result.current.if({ over: { minutes: 5 } }),
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
    const feed = Resource<{ items: string[] }, Params>(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(feed);
    });

    await expect(
      result.current.if({ over: { minutes: 5 } }, { cursor: "abc" }),
    ).resolves.toEqual({ items: ["abc"] });
    expect(fetcher).toHaveBeenCalledWith({ cursor: "abc" });
  });

  it("accepts an ISO 8601 duration string for over", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const user = Resource(fetcher);
    const { result } = renderHook(() => {
      const actions = useActions();
      return actions.useResource(user);
    });

    await result.current();
    await result.current.if({ over: "PT5M" });

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
