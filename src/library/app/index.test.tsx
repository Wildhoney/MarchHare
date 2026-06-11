import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import * as React from "react";
import { App, useContext, useEnv } from "./index.tsx";
import { Action } from "../action/index.ts";

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
