import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import * as React from "react";
import { App } from "../app/index.tsx";
import { Action } from "../action/index.ts";
import { Distribution } from "../types/index.ts";

describe("app.Scope()", () => {
  it("delivers a multicast dispatch to every subscriber inside <scope.Boundary>", async () => {
    class MulticastActions {
      static Tick = Action<number>("ScopeTickA", Distribution.Multicast);
    }

    const app = App();
    const scope = app.Scope<typeof MulticastActions>();

    const received: Array<{ source: string; value: number }> = [];

    function Subscriber({ source }: { source: string }) {
      const context = scope.useContext<void, never>();
      const actions = context.useActions();
      actions.useAction(MulticastActions.Tick, (_context, value) => {
        received.push({ source, value });
      });
      return null;
    }

    function Trigger() {
      const context = scope.useContext<void, typeof MulticastActions>();
      const actions = context.useActions();
      return (
        <button
          data-testid="trigger"
          onClick={() => actions.dispatch(MulticastActions.Tick, 7)}
        >
          fire
        </button>
      );
    }

    render(
      <app.Boundary>
        <scope.Boundary>
          <Subscriber source="a" />
          <Subscriber source="b" />
          <Trigger />
        </scope.Boundary>
      </app.Boundary>,
    );

    await act(async () => {
      screen.getByTestId("trigger").click();
    });

    expect(received).toEqual([
      { source: "a", value: 7 },
      { source: "b", value: 7 },
    ]);
  });

  it("does not leak across sibling <scope.Boundary> instances", async () => {
    class MulticastActions {
      static Tick = Action<number>("ScopeTickB", Distribution.Multicast);
    }

    const app = App();
    const scope = app.Scope<typeof MulticastActions>();

    const received: Array<{ tree: string; value: number }> = [];

    function Subscriber({ tree }: { tree: string }) {
      const context = scope.useContext<void, never>();
      const actions = context.useActions();
      actions.useAction(MulticastActions.Tick, (_context, value) => {
        received.push({ tree, value });
      });
      return null;
    }

    function Trigger({ id }: { id: string }) {
      const context = scope.useContext<void, typeof MulticastActions>();
      const actions = context.useActions();
      return (
        <button
          data-testid={id}
          onClick={() => actions.dispatch(MulticastActions.Tick, 1)}
        >
          fire
        </button>
      );
    }

    render(
      <app.Boundary>
        <scope.Boundary>
          <Subscriber tree="left" />
          <Trigger id="left-trigger" />
        </scope.Boundary>
        <scope.Boundary>
          <Subscriber tree="right" />
          <Trigger id="right-trigger" />
        </scope.Boundary>
      </app.Boundary>,
    );

    await act(async () => {
      screen.getByTestId("left-trigger").click();
    });

    expect(received).toEqual([{ tree: "left", value: 1 }]);
  });
});
