import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { Error, useError } from "./index";

function TestComponent() {
  const handler = useError();
  return <div data-testid="has-handler">{String(typeof handler)}</div>;
}

describe("Error", () => {
  it("should render children", () => {
    render(
      <Error handler={() => {}}>
        <div data-testid="child">Hello</div>
      </Error>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("should provide error handler via context", () => {
    render(
      <Error handler={() => {}}>
        <TestComponent />
      </Error>,
    );
    expect(screen.getByTestId("has-handler").textContent).toBe("function");
  });
});

describe("useError()", () => {
  it("should return undefined when not wrapped in Error", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("has-handler").textContent).toBe("undefined");
  });
});
