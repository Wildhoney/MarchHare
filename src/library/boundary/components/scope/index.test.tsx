import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Scope, withScope, useScope } from "./index";

function ScopeReader() {
  const scope = useScope();
  return (
    <div data-testid="scope-names">
      {scope ? Array.from(scope.keys()).join(",") : "none"}
    </div>
  );
}

describe("withScope", () => {
  it("should wrap the component in a Scope provider", () => {
    function Inner() {
      return <ScopeReader />;
    }

    const Wrapped = withScope("test-scope", Inner);

    render(<Wrapped />);

    expect(screen.getByTestId("scope-names").textContent).toBe("test-scope");
  });

  it("should forward props to the wrapped component", () => {
    function Inner(props: { label: string }) {
      return <div data-testid="label">{props.label}</div>;
    }

    const Wrapped = withScope("forwarding", Inner);

    render(<Wrapped label="Hello" />);

    expect(screen.getByTestId("label").textContent).toBe("Hello");
  });

  it("should nest within an existing Scope", () => {
    function Inner() {
      return <ScopeReader />;
    }

    const Wrapped = withScope("inner", Inner);

    render(
      <Scope name="outer">
        <Wrapped />
      </Scope>,
    );

    expect(screen.getByTestId("scope-names").textContent).toBe("outer,inner");
  });

  it("should name the wrapper by prepending 'Scoped' to the component name", () => {
    function Layout() {
      return <div />;
    }

    const Wrapped = withScope("naming", Layout);

    expect(Wrapped.name).toBe("ScopedLayout");
  });

  it("should fall back to 'ScopedComponent' for anonymous components", () => {
    const Wrapped = withScope("anon", () => <div />);

    expect(Wrapped.name).toBe("ScopedComponent");
  });

  it("should render children of the wrapped component", () => {
    function Inner() {
      return (
        <div data-testid="content">
          <span>Child A</span>
          <span>Child B</span>
        </div>
      );
    }

    const Wrapped = withScope("children-scope", Inner);

    render(<Wrapped />);

    expect(screen.getByTestId("content").textContent).toBe("Child AChild B");
  });
});
