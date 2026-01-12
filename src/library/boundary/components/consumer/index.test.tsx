import { describe, expect, it } from "@jest/globals";
import { render, screen, act } from "@testing-library/react";
import { Consumer, useConsumer, Partition } from "./index";
import { Broadcaster, useBroadcast } from "../broadcast/index";

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

describe("Partition", () => {
  const testAction = Symbol("test.action");

  function PartitionWrapper({
    children,
  }: {
    children: (broadcast: ReturnType<typeof useBroadcast>) => React.ReactNode;
  }) {
    const broadcast = useBroadcast();
    return <>{children(broadcast)}</>;
  }

  it("should render null when no value has been dispatched", () => {
    render(
      <Broadcaster>
        <Consumer>
          <Partition
            action={testAction}
            renderer={(box) => (
              <div data-testid="value">{String(box.value)}</div>
            )}
          />
        </Consumer>
      </Broadcaster>,
    );
    expect(screen.queryByTestId("value")).toBeNull();
  });

  it("should render value when payload is dispatched", () => {
    let broadcast: ReturnType<typeof useBroadcast>;

    render(
      <Broadcaster>
        <Consumer>
          <PartitionWrapper>
            {(b) => {
              broadcast = b;
              return (
                <Partition
                  action={testAction}
                  renderer={(box) => (
                    <div data-testid="value">{box.value.name}</div>
                  )}
                />
              );
            }}
          </PartitionWrapper>
        </Consumer>
      </Broadcaster>,
    );

    act(() => {
      broadcast.emit(testAction, { name: "Wildhoney" });
    });

    expect(screen.getByTestId("value").textContent).toBe("Wildhoney");
  });

  it("should provide working inspect proxy", () => {
    let broadcast: ReturnType<typeof useBroadcast>;

    render(
      <Broadcaster>
        <Consumer>
          <PartitionWrapper>
            {(b) => {
              broadcast = b;
              return (
                <Partition
                  action={testAction}
                  renderer={(box) => (
                    <div data-testid="pending">
                      {String(box.inspect.pending())}
                    </div>
                  )}
                />
              );
            }}
          </PartitionWrapper>
        </Consumer>
      </Broadcaster>,
    );

    act(() => {
      broadcast.emit(testAction, { name: "Wildhoney" });
    });

    expect(screen.getByTestId("pending").textContent).toBe("false");
  });

  it("should update when new payload is dispatched", () => {
    let broadcast: ReturnType<typeof useBroadcast>;

    render(
      <Broadcaster>
        <Consumer>
          <PartitionWrapper>
            {(b) => {
              broadcast = b;
              return (
                <Partition
                  action={testAction}
                  renderer={(box) => (
                    <div data-testid="value">{box.value.count}</div>
                  )}
                />
              );
            }}
          </PartitionWrapper>
        </Consumer>
      </Broadcaster>,
    );

    act(() => {
      broadcast.emit(testAction, { count: 1 });
    });
    expect(screen.getByTestId("value").textContent).toBe("1");

    act(() => {
      broadcast.emit(testAction, { count: 42 });
    });
    expect(screen.getByTestId("value").textContent).toBe("42");
  });
});
