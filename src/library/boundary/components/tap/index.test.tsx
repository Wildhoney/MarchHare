import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import * as React from "react";
import { Boundary } from "../../index.tsx";
import { useActions } from "../../../actions/index.ts";
import { Action } from "../../../action/index.ts";
import { Lifecycle } from "../../../types/index.ts";
import { Reason } from "../../../error/types.ts";
import type { Tapped } from "./types.ts";

type Model = { value: number };
type ActionsApi = ReturnType<typeof useActions<Model, typeof Actions>>;

class Actions {
  static Mount = Lifecycle.Mount();
  static Bump = Action<number>("Bump");
  static Crash = Action("Crash");
}

function take<T>(value: T | null): T {
  if (value === null) throw new Error("Probe never captured actions");
  return value;
}

function Probe({ onActions }: { onActions: (actions: ActionsApi) => void }) {
  const actions = useActions<Model, typeof Actions>({ value: 0 });

  actions.useAction(Actions.Mount, () => {
    // Registering ensures Lifecycle.Mount fires through the dispatch
    // pipeline so the tap sees it.
  });

  actions.useAction(Actions.Bump, (context, amount) => {
    context.actions.produce(({ model }) => {
      model.value += amount;
    });
  });

  actions.useAction(Actions.Crash, () => {
    throw new Error("boom");
  });

  React.useEffect(() => {
    onActions(actions);
  });

  return null;
}

function signature(event: Tapped): string {
  return event.stage === "start" ? "start" : `end:${event.result}`;
}

describe("Boundary tap", () => {
  it("fires start then end:success for a successful handler", async () => {
    const events: Tapped[] = [];
    const handle: { actions: ActionsApi | null } = { actions: null };

    render(
      <Boundary tap={(event) => events.push(event)}>
        <Probe onActions={(actions) => (handle.actions = actions)} />
      </Boundary>,
    );

    await act(async () => {
      await take(handle.actions)[1].dispatch(Actions.Bump, 3);
    });

    const lifecycle = events.filter((event) => event.action.name !== "Bump");
    const bumpEvents = events.filter((event) => event.action.name === "Bump");

    expect(bumpEvents.map(signature)).toEqual(["start", "end:success"]);
    expect(bumpEvents[0].action.payload).toBe(3);
    const completed = bumpEvents[1];
    if (completed.stage !== "end" || completed.result !== "success") {
      throw new Error("expected end:success");
    }
    expect(completed.details.elapsed).toBeGreaterThanOrEqual(0);
    // Bump produces a model mutation; env is untouched.
    expect(completed.details.mutations.model).not.toBeNull();
    const modelSnapshot = completed.details.mutations.model as {
      before: { value: number };
      after: { value: number };
    };
    expect(modelSnapshot.before.value).toBe(0);
    expect(modelSnapshot.after.value).toBe(3);
    expect(completed.details.mutations.env).toBeNull();
    // Lifecycle Mount also produces a tap pair — sanity check it ran.
    expect(lifecycle.some((event) => event.stage === "start")).toBe(true);
  });

  it("fires start then end:error for a throwing handler, no success", async () => {
    const events: Tapped[] = [];
    const handle: { actions: ActionsApi | null } = { actions: null };

    render(
      <Boundary tap={(event) => events.push(event)}>
        <Probe onActions={(actions) => (handle.actions = actions)} />
      </Boundary>,
    );

    await act(async () => {
      await take(handle.actions)[1].dispatch(Actions.Crash);
    });

    const crashEvents = events.filter((event) => event.action.name === "Crash");
    expect(crashEvents.map(signature)).toEqual(["start", "end:error"]);
    const errored = crashEvents[1];
    if (errored.stage !== "end" || errored.result !== "error") {
      throw new Error("expected end:error");
    }
    expect(errored.details.error).toBeInstanceOf(Error);
    expect(errored.details.error.message).toBe("boom");
    expect(errored.details.reason).toBe(Reason.Errored);
    // Crash handler throws before any produce — no model/env changes.
    expect(errored.details.mutations.model).toBeNull();
    expect(errored.details.mutations.env).toBeNull();
  });

  it("is a no-op when the tap prop is omitted", async () => {
    const handle: { actions: ActionsApi | null } = { actions: null };

    render(
      <Boundary>
        <Probe onActions={(actions) => (handle.actions = actions)} />
      </Boundary>,
    );

    await act(async () => {
      await take(handle.actions)[1].dispatch(Actions.Bump, 1);
    });

    expect(take(handle.actions)[0].value).toBe(1);
  });

  it("invokes the latest tap callback when the prop changes", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const handle: { actions: ActionsApi | null } = { actions: null };

    function Wrapper({ tap }: { tap: (event: Tapped) => void }) {
      return (
        <Boundary tap={tap}>
          <Probe onActions={(actions) => (handle.actions = actions)} />
        </Boundary>
      );
    }

    const { rerender } = render(<Wrapper tap={first} />);

    await act(async () => {
      await take(handle.actions)[1].dispatch(Actions.Bump, 1);
    });

    rerender(<Wrapper tap={second} />);

    await act(async () => {
      await take(handle.actions)[1].dispatch(Actions.Bump, 1);
    });

    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    const secondCalls = second.mock.calls
      .map(([event]) => event as Tapped)
      .filter((event) => event.action.name === "Bump");
    expect(secondCalls.map(signature)).toEqual(["start", "end:success"]);
  });
});
