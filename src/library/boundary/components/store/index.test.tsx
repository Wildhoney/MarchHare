import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act, render, screen } from "@testing-library/react";
import { Store, useStore } from "./index.tsx";
import { Boundary } from "../../index.tsx";
import { Resource } from "../../../resource/index.ts";
import { useActions } from "../../../hooks/index.ts";
import { Action, Lifecycle } from "../../../index.ts";

// Module augmentation requires `interface` (interface merging is the only
// way to extend the library's Store type).

declare module "../../../index.ts" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Store {
    counter: number;
    label: string | null;
    token: string | null;
  }
}

describe("useStore — dot reads", () => {
  it("returns the fallback empty store outside any provider", () => {
    const { result } = renderHook(() => useStore());
    expect(result.current.counter).toBeUndefined();
  });

  it("reads the initial store value supplied to the provider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Store initial={{ counter: 7, label: "seed", token: null }}>
        {children}
      </Store>
    );

    const { result } = renderHook(() => useStore(), { wrapper });

    expect(result.current.counter).toBe(7);
    expect(result.current.label).toBe("seed");
  });

  it("Boundary wires the Store through its `store` prop", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 3, label: "boundary", token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(() => useStore(), { wrapper });

    expect(result.current.counter).toBe(3);
    expect(result.current.label).toBe("boundary");
  });

  it("throws on direct assignment (writes only via produce)", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Store initial={{ counter: 0, label: null, token: null }}>
        {children}
      </Store>
    );

    const { result } = renderHook(() => useStore(), { wrapper });

    expect(() => {
      (result.current as { counter: number }).counter = 9;
    }).toThrow(/read-only/i);
  });
});

describe("Store mutations via context.actions.produce", () => {
  class Actions {
    static Mount = Lifecycle.Mount();
    static Bump = Action("Bump");
  }
  type Model = { snapshot: number | null };

  it("writes through to the Store ref and reads back fresh", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const store = useStore();
        const actions = useActions<Model, typeof Actions>({ snapshot: null });
        actions.useAction(Actions.Bump, (context) => {
          context.actions.produce(({ model, store: draft }) => {
            draft.counter = (draft.counter ?? 0) + 1;

            model.snapshot = draft.counter;
          });
        });
        return { store, actions };
      },
      { wrapper },
    );

    expect(result.current.store.counter).toBe(0);

    act(() => {
      result.current.actions[1].dispatch(Actions.Bump);
    });

    expect(result.current.store.counter).toBe(1);
    expect(result.current.actions[0].snapshot).toBe(1);
  });
});

describe("Resource fetchers receive the Store snapshot", () => {
  it("passes the surrounding Boundary's Store to the fetcher's args", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ ok: true }));
    const resource = Resource(fetcher);

    class Actions {
      static Fetch = Action("Fetch");
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: "abc-123" }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<void, typeof Actions>();
        actions.useAction(Actions.Fetch, async (context) => {
          await context.actions.resource(resource());
        });
        return actions;
      },
      { wrapper },
    );

    await act(async () => {
      await result.current[1].dispatch(Actions.Fetch);
    });

    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({
        store: { counter: 0, label: null, token: "abc-123" },
      }),
    );
  });

  it("each fetch reads a fresh Store after a handler write", async () => {
    const captured: Array<string | null> = [];
    const resource = Resource(
      ({ store }: { store: { token: string | null } }) => {
        captured.push(store.token);
        return Promise.resolve({ ok: true });
      },
    );

    class Actions {
      static Fetch = Action("Fetch");
      static SetToken = Action<string>("SetToken");
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: "first" }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<void, typeof Actions>();
        actions.useAction(Actions.Fetch, async (context) => {
          await context.actions.resource(resource());
        });
        actions.useAction(Actions.SetToken, (context, value) => {
          context.actions.produce(({ store }) => {
            store.token = value;
          });
        });
        return actions;
      },
      { wrapper },
    );

    await act(async () => {
      await result.current[1].dispatch(Actions.Fetch);
    });
    await act(async () => {
      await result.current[1].dispatch(Actions.SetToken, "second");
    });
    await act(async () => {
      await result.current[1].dispatch(Actions.Fetch);
    });

    expect(captured).toEqual(["first", "second"]);
  });
});

describe("context.actions.resource.set(...) for out-of-band updates", () => {
  it("writes into the cache so subsequent invocations see the new value", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Network" }));
    const resource = Resource(fetcher);

    class Actions {
      static Push = Action<{ name: string }>("Push");
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<void, typeof Actions>();
        actions.useAction(Actions.Push, (context, payload) => {
          context.actions.resource.set(resource(), payload);
        });
        return actions;
      },
      { wrapper },
    );

    expect(resource()).toBeNull();

    await act(async () => {
      await result.current[1].dispatch(Actions.Push, { name: "FromSSE" });
    });

    expect(resource()).toEqual({ name: "FromSSE" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("threads params for parameterised Resources", async () => {
    type Params = { id: number };
    const resource = Resource<{ id: number; name: string }, Params>(
      ({ params }) => Promise.resolve({ id: params.id, name: "Network" }),
    );

    class Actions {
      static Push = Action<{ id: number; name: string }>("Push");
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<void, typeof Actions>();
        actions.useAction(Actions.Push, (context, payload) => {
          context.actions.resource.set(resource({ id: payload.id }), payload);
        });
        return actions;
      },
      { wrapper },
    );

    await act(async () => {
      await result.current[1].dispatch(Actions.Push, {
        id: 5,
        name: "Pushed",
      });
    });

    expect(resource({ id: 5 })).toEqual({ id: 5, name: "Pushed" });
    expect(resource({ id: 6 })).toBeNull();
  });
});

describe("context.actions.resource(...).exceeds({...})", () => {
  it("short-circuits when the cache is within the freshness window", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ name: "Adam" }));
    const resource = Resource(fetcher);

    class Actions {
      static Mount = Lifecycle.Mount();
      static Refresh = Action("Refresh");
    }
    type Model = { value: string | null };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<Model, typeof Actions>({ value: null });
        actions.useAction(Actions.Mount, async (context) => {
          const data = await context.actions.resource(resource());
          context.actions.produce(({ model }) => {
            model.value = data.name;
          });
        });
        actions.useAction(Actions.Refresh, async (context) => {
          // Should NOT fetch — cache is fresh within window.
          await context.actions.resource(resource()).exceeds({ minutes: 5 });
        });
        return actions;
      },
      { wrapper },
    );

    // Mount fired and called the fetcher once.
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current[1].dispatch(Actions.Refresh);
    });

    expect(fetcher).toHaveBeenCalledTimes(1); // no second fetch
  });
});

describe("Lifecycle.Store broadcast", () => {
  it("fires the handler when produce mutates the store", async () => {
    const seen: Array<number | undefined> = [];

    class Actions {
      static Bump = Action("Bump");
    }

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<void, typeof Actions>();
        actions.useAction(Actions.Bump, (context) => {
          context.actions.produce(({ store }) => {
            store.counter = (store.counter ?? 0) + 1;
          });
        });
        actions.useAction(Lifecycle.Store, (_context, store) => {
          seen.push(store.counter);
        });
        return actions;
      },
      { wrapper },
    );

    // Initial replay on mount delivers the seeded value.
    await vi.waitFor(() => expect(seen).toEqual([0]));

    await act(async () => {
      await result.current[1].dispatch(Actions.Bump);
    });
    await act(async () => {
      await result.current[1].dispatch(Actions.Bump);
    });

    expect(seen).toEqual([0, 1, 2]);
  });

  it("does not fire when only the model changes", async () => {
    const seen: unknown[] = [];

    class Actions {
      static SetModel = Action<string>("SetModel");
    }
    type Model = { value: string | null };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: null, token: null }}>
        {children}
      </Boundary>
    );

    const { result } = renderHook(
      () => {
        const actions = useActions<Model, typeof Actions>({ value: null });
        actions.useAction(Actions.SetModel, (context, value) => {
          context.actions.produce(({ model }) => {
            model.value = value;
          });
        });
        actions.useAction(Lifecycle.Store, (_context, store) => {
          seen.push(store);
        });
        return actions;
      },
      { wrapper },
    );

    // Drain the initial replay so we can assert only on subsequent dispatches.
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    seen.length = 0;

    await act(async () => {
      await result.current[1].dispatch(Actions.SetModel, "x");
    });

    expect(seen).toEqual([]);
  });

  it("delivers the initial store to a late-mounting subscriber via replay", async () => {
    const seen: Array<string | null> = [];

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Boundary store={{ counter: 0, label: "seeded", token: null }}>
        {children}
      </Boundary>
    );

    renderHook(
      () => {
        const actions = useActions();
        actions.useAction(Lifecycle.Store, (_context, store) => {
          seen.push(store.label);
        });
        return actions;
      },
      { wrapper },
    );

    await vi.waitFor(() => expect(seen).toEqual(["seeded"]));
  });

  it("renders the current store value via actions.stream(Lifecycle.Store, ...)", async () => {
    class Actions {
      static Set = Action<string>("Set");
    }

    function Probe() {
      const actions = useActions<void, typeof Actions>();
      actions.useAction(Actions.Set, (context, value) => {
        context.actions.produce(({ store }) => {
          store.label = value;
        });
      });

      return (
        <div>
          <span data-testid="label">
            {actions[1].stream(Lifecycle.Store, (store) => store.label ?? "—")}
          </span>
          <button
            data-testid="set"
            onClick={() => actions.dispatch(Actions.Set, "renamed")}
          />
        </div>
      );
    }

    render(
      <Boundary store={{ counter: 0, label: "initial", token: null }}>
        <Probe />
      </Boundary>,
    );

    expect(screen.getByTestId("label").textContent).toBe("initial");

    await act(async () => {
      screen.getByTestId("set").click();
    });

    expect(screen.getByTestId("label").textContent).toBe("renamed");
  });
});
