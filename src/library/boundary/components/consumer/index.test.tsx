import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { Consumer, useConsumer } from "./index";

function TestComponent() {
  const consumer = useConsumer();
  return <div data-testid="has-map">{String(consumer instanceof Map)}</div>;
}

describe("Consumer", () => {
  it("should render children", () => {
    render(
      <Consumer>
        <div data-testid="child">Hello</div>
      </Consumer>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("should provide consumer context with Map", () => {
    render(
      <Consumer>
        <TestComponent />
      </Consumer>,
    );
    expect(screen.getByTestId("has-map").textContent).toBe("true");
  });

  it("should provide isolated contexts for nested Consumers", () => {
    function InnerComponent({ testId }: { testId: string }) {
      const consumer = useConsumer();
      consumer.set(Symbol("test"), { state: {} as never });
      return <div data-testid={testId}>{String(consumer.size)}</div>;
    }

    render(
      <Consumer>
        <InnerComponent testId="outer" />
        <Consumer>
          <InnerComponent testId="inner" />
        </Consumer>
      </Consumer>,
    );

    // Each Consumer should have its own isolated Map
    expect(screen.getByTestId("outer").textContent).toBe("1");
    expect(screen.getByTestId("inner").textContent).toBe("1");
  });
});

describe("useConsumer()", () => {
  it("should return default context when not wrapped in Consumer", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("has-map").textContent).toBe("true");
  });
});
