import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { Broadcaster, useBroadcast } from "./index";
import EventEmitter from "eventemitter3";

function TestComponent() {
  const broadcast = useBroadcast();
  return (
    <div data-testid="has-emitter">
      {String(broadcast.instance instanceof EventEmitter)}
    </div>
  );
}

describe("Broadcaster", () => {
  it("should render children", () => {
    render(
      <Broadcaster>
        <div data-testid="child">Hello</div>
      </Broadcaster>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("should provide broadcast context with EventEmitter", () => {
    render(
      <Broadcaster>
        <TestComponent />
      </Broadcaster>,
    );
    expect(screen.getByTestId("has-emitter").textContent).toBe("true");
  });
});

describe("useBroadcast()", () => {
  it("should return default context when not wrapped in Broadcaster", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("has-emitter").textContent).toBe("true");
  });
});
