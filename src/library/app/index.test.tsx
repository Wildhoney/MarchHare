import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { App, useContext, useEnv } from "./index.tsx";
import { Action } from "../action/index.ts";
import { Cache, type Adapter } from "../cache/index.ts";
import { Lifecycle } from "../types/index.ts";

describe("standalone useContext<E, ...> / useEnv<E>", () => {
  it("lets a reusable component run under different Apps", async () => {
    type WebEnv = { kind: "web"; locale: string };
    type MobileEnv = { kind: "mobile"; platform: "ios" | "android" };
    type Envs = WebEnv | MobileEnv;

    const web = App<WebEnv>({ env: { kind: "web", locale: "en-GB" } });
    const mobile = App<MobileEnv>({
      env: { kind: "mobile", platform: "ios" },
    });

    type Model = { name: string };
    const model: Model = { name: "anon" };

    class Actions {
      static Sign = Action<string>("ReusableSign");
    }

    function Profile({ testid }: { testid: string }) {
      const env = useEnv<Envs>();
      const context = useContext<Envs, Model, typeof Actions>();
      const [view, actions] = context.useActions(model);

      const where = env.kind === "web" ? env.locale : env.platform;

      return (
        <button
          data-testid={testid}
          onClick={() => actions.dispatch(Actions.Sign, "Adam")}
        >
          {view.name}/{where}
        </button>
      );
    }

    render(
      <>
        <web.Boundary>
          <Profile testid="web" />
        </web.Boundary>
        <mobile.Boundary>
          <Profile testid="mobile" />
        </mobile.Boundary>
      </>,
    );

    expect(screen.getByTestId("web").textContent).toBe("anon/en-GB");
    expect(screen.getByTestId("mobile").textContent).toBe("anon/ios");
  });

  it("actions.stream(Lifecycle.Env, ...) exposes union-arm-specific fields on inspect", async () => {
    // Mirrors the Hive Envs shape: multiple arms, of which only some have
    // an `account` slot, and the slot itself is `Maybe<Account> = Account
    // | null | undefined`. Cross-arm distribution must reach `accountName`
    // on the account arm, otherwise navigation collapses to `undefined`.
    type Account = {
      id: string;
      accountName?: string;
      profile?: { handle?: string };
    };
    type Maybe<T> = T | null | undefined;
    type WebCorporate = {
      portal: "web";
      account: Maybe<Account>;
    };
    type AppCorporate = {
      portal: "app";
      account: Maybe<Account>;
    };
    type WebPayment = { portal: "payment" };
    type WebVerify = { portal: "verify" };
    type Envs = WebCorporate | AppCorporate | WebPayment | WebVerify;
    type WebEnv = WebCorporate;
    type MobileEnv = WebPayment;

    const web = App<WebEnv>({
      env: {
        portal: "web",
        account: { id: "A", accountName: "Adam", profile: { handle: "atimb" } },
      },
    });
    const payment = App<MobileEnv>({
      env: { portal: "payment" },
    });

    type Model = { ready: boolean };
    const model: Model = { ready: true };

    function Probe({ testid }: { testid: string }) {
      const context = useContext<Envs, Model>();
      const [, actions] = context.useActions(model);
      return (
        <div data-testid={testid}>
          {actions.stream(Lifecycle.Env, (env, inspect) => {
            // Two-level cross-arm distribution. `inspect.account` reduces
            // to `Inspect<Account | null | undefined>`; navigating into
            // `.accountName` must distribute that union again so the leaf
            // is `Box<string | undefined>`, not `Box<undefined>`.
            const nameBox = inspect.account.accountName.box();
            const handleBox = inspect.account.profile.handle.box();
            const name: string | undefined = nameBox.value;
            const handle: string | undefined = handleBox.value;
            if (env.portal === "web") {
              return `web:${env.account?.accountName ?? "-"}/${name ?? "-"}/${handle ?? "-"}`;
            }
            return `payment:${env.portal}`;
          })}
        </div>
      );
    }

    render(
      <>
        <web.Boundary>
          <Probe testid="web-stream" />
        </web.Boundary>
        <payment.Boundary>
          <Probe testid="payment-stream" />
        </payment.Boundary>
      </>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(screen.getByTestId("web-stream").textContent).toBe(
      "web:Adam/Adam/atimb",
    );
    expect(screen.getByTestId("payment-stream").textContent).toBe(
      "payment:payment",
    );
  });

  it("useEnv<E>() reads the nearest Boundary's env", () => {
    type WebEnv = { tag: "web" };
    type MobileEnv = { tag: "mobile" };
    type Envs = WebEnv | MobileEnv;

    const web = App<WebEnv>({ env: { tag: "web" } });
    const mobile = App<MobileEnv>({ env: { tag: "mobile" } });

    function Probe({ testid }: { testid: string }) {
      const env = useEnv<Envs>();
      return <span data-testid={testid}>{env.tag}</span>;
    }

    render(
      <>
        <web.Boundary>
          <Probe testid="a" />
        </web.Boundary>
        <mobile.Boundary>
          <Probe testid="b" />
        </mobile.Boundary>
      </>,
    );

    expect(screen.getByTestId("a").textContent).toBe("web");
    expect(screen.getByTestId("b").textContent).toBe("mobile");
  });

  it("dispatch from a reusable component reaches its own boundary's handlers", async () => {
    type Env = { name: string };
    const alpha = App<Env>({ env: { name: "alpha" } });
    const beta = App<Env>({ env: { name: "beta" } });

    type Model = { count: number };
    const model: Model = { count: 0 };

    class Actions {
      static Tick = Action("ReusableTick");
    }

    function useCounterActions() {
      const context = useContext<Env, Model, typeof Actions>();
      const actions = context.useActions(model);

      actions.useAction(Actions.Tick, (context) =>
        context.actions.produce(({ model }) => void (model.count += 1)),
      );

      return actions;
    }

    function Counter({ testid }: { testid: string }) {
      const [view, actions] = useCounterActions();

      return (
        <button
          data-testid={testid}
          onClick={() => actions.dispatch(Actions.Tick)}
        >
          {view.count}
        </button>
      );
    }

    render(
      <>
        <alpha.Boundary>
          <Counter testid="alpha" />
        </alpha.Boundary>
        <beta.Boundary>
          <Counter testid="beta" />
        </beta.Boundary>
      </>,
    );

    await act(async () => {
      screen.getByTestId("alpha").click();
    });

    expect(screen.getByTestId("alpha").textContent).toBe("1");
    expect(screen.getByTestId("beta").textContent).toBe("0");
  });
});

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

describe("App({ cache }) with scoped key(context)", () => {
  it("writes successful fetches under the live Env's scope prefix", async () => {
    type AppEnv = { session: { accessToken: string } | null };

    const adapter = memoryAdapter();
    const app = App<AppEnv>({
      env: { session: { accessToken: "alice" } },
      cache: Cache<AppEnv>({
        ...adapter,
        key: ({ env }) => env.session?.accessToken ?? "",
      }),
    });

    const user = app.Resource<{ name: string }>(() =>
      Promise.resolve({ name: "Adam" }),
    );

    class Actions {
      static Mount = Lifecycle.Mount();
    }

    function Profile() {
      const context = app.useContext<void, typeof Actions>();
      const actions = context.useActions();

      actions.useAction(Actions.Mount, async (context) => {
        await context.actions.resource(user());
      });

      return <span data-testid="profile">ready</span>;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Profile />
        </app.Boundary>,
      );
    });

    const stored = [...adapter.entries.keys()];
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^mh:alice:\d+:\{\}$/);
  });

  it("sync .get() under the Boundary resolves the scoped slot", async () => {
    type AppEnv = { session: { accessToken: string } | null };

    const adapter = memoryAdapter();
    const app = App<AppEnv>({
      env: { session: { accessToken: "alice" } },
      cache: Cache<AppEnv>({
        ...adapter,
        key: ({ env }) => env.session?.accessToken ?? "",
      }),
    });

    const user = app.Resource<{ name: string }>(() =>
      Promise.resolve({ name: "Adam" }),
    );

    type Model = { user: { name: string } | null };
    class Actions {
      static Mount = Lifecycle.Mount();
    }

    function Profile() {
      const context = app.useContext<Model, typeof Actions>();
      const actions = context.useActions({ user: user.get() });
      const [view] = actions;

      actions.useAction(Actions.Mount, async (context) => {
        const u = await context.actions.resource(user());
        context.actions.produce(({ model }) => void (model.user = u));
      });

      return (
        <span data-testid="profile">{view.user?.name ?? "(loading)"}</span>
      );
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Profile />
        </app.Boundary>,
      );
    });

    expect(screen.getByTestId("profile").textContent).toBe("Adam");

    function Probe() {
      const cached = user.get();
      return <span data-testid="probe">{cached?.name ?? "(empty)"}</span>;
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Probe />
        </app.Boundary>,
      );
    });

    expect(screen.getByTestId("probe").textContent).toBe("Adam");
  });

  it("scopes mutate when context.actions.produce updates env.session", async () => {
    type AppEnv = { session: { accessToken: string } | null };

    const adapter = memoryAdapter();
    const app = App<AppEnv>({
      env: { session: { accessToken: "alice" } },
      cache: Cache<AppEnv>({
        ...adapter,
        key: ({ env }) => env.session?.accessToken ?? "",
      }),
    });

    const user = app.Resource<{ name: string }>(({ env }) =>
      Promise.resolve({ name: env.session?.accessToken ?? "anon" }),
    );

    class Actions {
      static Mount = Lifecycle.Mount();
      static Switch = Action("Switch");
    }

    function Profile() {
      const context = app.useContext<void, typeof Actions>();
      const actions = context.useActions();

      actions.useAction(Actions.Mount, async (context) => {
        await context.actions.resource(user());
      });

      actions.useAction(Actions.Switch, async (context) => {
        context.actions.produce(({ env }) => {
          env.session = { accessToken: "bob" };
        });
        await context.actions.resource(user());
      });

      return (
        <button
          data-testid="switch"
          onClick={() => actions.dispatch(Actions.Switch)}
        >
          go
        </button>
      );
    }

    await act(async () => {
      render(
        <app.Boundary>
          <Profile />
        </app.Boundary>,
      );
    });

    await act(async () => {
      screen.getByTestId("switch").click();
    });

    const stored = [...adapter.entries.keys()].sort();
    expect(stored).toHaveLength(2);
    expect(stored.some((cacheKey) => cacheKey.startsWith("mh:alice:"))).toBe(
      true,
    );
    expect(stored.some((cacheKey) => cacheKey.startsWith("mh:bob:"))).toBe(
      true,
    );
  });
});
