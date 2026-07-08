import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { App } from "../app/index.tsx";
import { Lifecycle } from "../types/index.ts";

type Env = { ready: boolean };

function appWithoutCache() {
  return App<Env>({ env: { ready: true } });
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Resource.action end-to-end", () => {
  it("fires the broadcast to every subscriber on the originating boundary", async () => {
    const app = appWithoutCache();
    const user = app.Resource<{ name: string }>(() =>
      Promise.resolve({ name: "Adam" }),
    );

    const seen = vi.fn<(value: { name: string } | null) => void>();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(user());
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(user.action(), (_context, value) => {
        seen(value);
      });
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ name: "Adam" });
  });

  it("filters by an exact channel match", async () => {
    const app = appWithoutCache();
    type Params = { id: number };
    const userById = app.Resource<{ id: number; name: string }, Params>(
      ({ params }) =>
        Promise.resolve({ id: params.id, name: `User ${params.id}` }),
    );

    const seenForFive = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(userById({ id: 5 }));
        await context.actions.resource(userById({ id: 7 }));
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(userById.action({ id: 5 }), (_context, value) => {
        seenForFive(value);
      });
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(seenForFive).toHaveBeenCalledTimes(1);
    expect(seenForFive).toHaveBeenCalledWith({ id: 5, name: "User 5" });
  });

  it("narrows a partial filter against a fully-specified dispatch channel", async () => {
    const app = appWithoutCache();
    type Params = { id: number; orgId: number };
    const member = app.Resource<{ id: number; orgId: number }, Params>(
      ({ params }) => Promise.resolve({ id: params.id, orgId: params.orgId }),
    );

    const partial = vi.fn();
    const otherOrg = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await Promise.all([
          context.actions.resource(member({ id: 1, orgId: 42 })),
          context.actions.resource(member({ id: 2, orgId: 42 })),
          context.actions.resource(member({ id: 3, orgId: 99 })),
        ]);
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(member.action({ orgId: 42 }), (_context, value) => {
        partial(value);
      });
      actions.useAction(member.action({ orgId: 99 }), (_context, value) => {
        otherOrg(value);
      });
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(partial).toHaveBeenCalledTimes(2);
    expect(partial.mock.calls.map(([value]) => value)).toEqual(
      expect.arrayContaining([
        { id: 1, orgId: 42 },
        { id: 2, orgId: 42 },
      ]),
    );
    expect(otherOrg).toHaveBeenCalledTimes(1);
    expect(otherOrg).toHaveBeenCalledWith({ id: 3, orgId: 99 });
  });

  it("renders via actions.stream as the resource resolves", async () => {
    const app = appWithoutCache();
    type Params = { id: number };
    const gate = deferred<{ id: number; name: string }>();
    const userById = app.Resource<{ id: number; name: string }, Params>(
      () => gate.promise,
    );

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(userById({ id: 5 }));
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const [, api] = context.useActions();
      return (
        <span data-testid="watcher">
          {api.stream(userById.action({ id: 5 }), (value) => value?.name)}
        </span>
      );
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(screen.getByTestId("watcher").textContent).toBe("");

    await act(async () => {
      gate.resolve({ id: 5, name: "Adam" });
      await gate.promise;
    });

    expect(screen.getByTestId("watcher").textContent).toBe("Adam");
  });

  it("does not broadcast when the fetcher rejects", async () => {
    const app = appWithoutCache();
    const fail = app.Resource<{ name: string }>(() =>
      Promise.reject(new Error("nope")),
    );

    const seen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
      static Error = Lifecycle.Error();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(fail());
      });
      actions.useAction(FetcherActions.Error, () => {
        // swallow the propagated rejection
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(fail.action(), () => {
        seen();
      });
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(seen).not.toHaveBeenCalled();
  });

  it("does not leak the broadcast across sibling boundaries", async () => {
    const app = appWithoutCache();
    const user = app.Resource<{ name: string }>(() =>
      Promise.resolve({ name: "Adam" }),
    );

    const insideSeen = vi.fn();
    const outsideSeen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(user()).isolated();
      });
      return null;
    }

    function Watcher({ onSeen }: { onSeen: () => void }) {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(user.action(), () => {
        onSeen();
      });
      return null;
    }

    await act(async () => {
      render(
        <>
          <app.Boundary>
            <Fetcher />
            <Watcher onSeen={insideSeen} />
          </app.Boundary>
          <app.Boundary>
            <Watcher onSeen={outsideSeen} />
          </app.Boundary>
        </>,
      );
    });

    expect(insideSeen).toHaveBeenCalled();
    expect(outsideSeen).not.toHaveBeenCalled();
  });

  it("matches subscribers with overlapping filters all at once", async () => {
    const app = appWithoutCache();
    type Params = { id: number; role: string };
    const team = app.Resource<{ id: number; role: string }, Params>(
      ({ params }) => Promise.resolve({ id: params.id, role: params.role }),
    );

    const open = vi.fn();
    const adminOnly = vi.fn();
    const exact = vi.fn();
    const other = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(team({ id: 5, role: "admin" }));
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(team.action(), () => {
        open();
      });
      actions.useAction(team.action({ role: "admin" }), () => {
        adminOnly();
      });
      actions.useAction(team.action({ id: 5, role: "admin" }), () => {
        exact();
      });
      actions.useAction(team.action({ id: 5, role: "viewer" }), () => {
        other();
      });
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(adminOnly).toHaveBeenCalledTimes(1);
    expect(exact).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("replays every matching cached entry to a late-mounting subscriber", async () => {
    const app = appWithoutCache();
    type Params = { id: number; orgId: number };
    const fetcherCalls: Params[] = [];
    const member = app.Resource<{ id: number; orgId: number }, Params>(
      ({ params }) => {
        fetcherCalls.push(params);
        return Promise.resolve({ id: params.id, orgId: params.orgId });
      },
    );

    const seen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await Promise.all([
          context.actions.resource(member({ id: 1, orgId: 42 })),
          context.actions.resource(member({ id: 2, orgId: 42 })),
          context.actions.resource(member({ id: 3, orgId: 99 })),
        ]);
      });
      return null;
    }

    function LateWatcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(member.action({ orgId: 42 }), (_context, value) => {
        seen(value);
      });
      return null;
    }

    let mountLate: () => void = () => {};
    function Harness() {
      const [late, setLate] = React.useState(false);
      mountLate = () => setLate(true);
      return (
        <app.Boundary>
          <Fetcher />
          {late ? <LateWatcher /> : null}
        </app.Boundary>
      );
    }

    await act(async () => {
      render(<Harness />);
    });

    expect(fetcherCalls).toHaveLength(3);
    expect(seen).not.toHaveBeenCalled();

    await act(async () => {
      mountLate();
    });

    expect(seen).toHaveBeenCalledTimes(2);
    const replayed = seen.mock.calls.map(([value]) => value as object);
    expect(replayed).toEqual(
      expect.arrayContaining([
        { id: 1, orgId: 42 },
        { id: 2, orgId: 42 },
      ]),
    );
  });

  it("seeds stream() on mount from the cached entry matching the filter", async () => {
    const app = appWithoutCache();
    type Params = { id: number };
    const userById = app.Resource<{ id: number; name: string }, Params>(
      ({ params }) =>
        Promise.resolve({ id: params.id, name: `User ${params.id}` }),
    );

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(userById({ id: 9 }));
      });
      return null;
    }

    function LateStream() {
      const context = app.useContext();
      const [, api] = context.useActions();
      return (
        <span data-testid="late-stream">
          {api.stream(userById.action({ id: 9 }), (value) => value?.name)}
        </span>
      );
    }

    const { rerender } = render(
      <app.Boundary>
        <Fetcher />
      </app.Boundary>,
    );

    await act(async () => {
      rerender(
        <app.Boundary>
          <Fetcher />
        </app.Boundary>,
      );
    });

    await act(async () => {
      rerender(
        <app.Boundary>
          <Fetcher />
          <LateStream />
        </app.Boundary>,
      );
    });

    expect(screen.getByTestId("late-stream").textContent).toBe("User 9");
  });

  it("still broadcasts when the originating caller's task aborts mid-fetch", async () => {
    const app = appWithoutCache();
    const gate = deferred<{ name: string }>();
    const user = app.Resource<{ name: string }>(() => gate.promise);

    const seen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await context.actions.resource(user());
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(user.action(), (_context, value) => {
        seen(value);
      });
      return null;
    }

    const { rerender } = render(
      <app.Boundary>
        <Fetcher />
        <Watcher />
      </app.Boundary>,
    );

    await act(async () => {
      rerender(
        <app.Boundary>
          <Fetcher />
          <Watcher />
        </app.Boundary>,
      );
    });

    expect(seen).not.toHaveBeenCalled();

    await act(async () => {
      rerender(
        <app.Boundary>
          <Watcher />
        </app.Boundary>,
      );
    });

    await act(async () => {
      gate.resolve({ name: "Adam" });
      await gate.promise;
    });

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ name: "Adam" });
  });
});

describe("Resource.action — call variants", () => {
  type Params = { id: number; orgId: number };

  function buildResource(app: ReturnType<typeof appWithoutCache>) {
    return app.Resource<Params, Params>(({ params }) =>
      Promise.resolve(params),
    );
  }

  it(".action() matches every successful fetch on the resource", async () => {
    const app = appWithoutCache();
    const member = buildResource(app);
    const seen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await Promise.all([
          context.actions.resource(member({ id: 1, orgId: 42 })),
          context.actions.resource(member({ id: 2, orgId: 99 })),
        ]);
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(member.action(), (_context, value) => seen(value));
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen.mock.calls.map(([value]) => value)).toEqual(
      expect.arrayContaining([
        { id: 1, orgId: 42 },
        { id: 2, orgId: 99 },
      ]),
    );
  });

  it(".action(partial) matches every fetch whose channel includes the filter", async () => {
    const app = appWithoutCache();
    const member = buildResource(app);
    const seen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await Promise.all([
          context.actions.resource(member({ id: 1, orgId: 42 })),
          context.actions.resource(member({ id: 2, orgId: 42 })),
          context.actions.resource(member({ id: 3, orgId: 99 })),
        ]);
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(member.action({ orgId: 42 }), (_context, value) =>
        seen(value),
      );
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(seen).toHaveBeenCalledTimes(2);
    expect(seen.mock.calls.map(([value]) => value)).toEqual(
      expect.arrayContaining([
        { id: 1, orgId: 42 },
        { id: 2, orgId: 42 },
      ]),
    );
  });

  it(".action(full) matches only the exact channel", async () => {
    const app = appWithoutCache();
    const member = buildResource(app);
    const seen = vi.fn();

    class FetcherActions {
      static Mount = Lifecycle.Mount();
    }
    function Fetcher() {
      const context = app.useContext<void, typeof FetcherActions>();
      const actions = context.useActions();
      actions.useAction(FetcherActions.Mount, async (context) => {
        await Promise.all([
          context.actions.resource(member({ id: 1, orgId: 42 })),
          context.actions.resource(member({ id: 2, orgId: 42 })),
          context.actions.resource(member({ id: 1, orgId: 99 })),
        ]);
      });
      return null;
    }

    function Watcher() {
      const context = app.useContext();
      const actions = context.useActions();
      actions.useAction(
        member.action({ id: 1, orgId: 42 }),
        (_context, value) => seen(value),
      );
      return null;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Watcher />
          <Fetcher />
        </app.Boundary>,
      );
    });

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ id: 1, orgId: 42 });
  });
});
