import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { withScope, useScope } from "./index";
import { Action } from "../../../action/index.ts";
import { Distribution } from "../../../types/index.ts";

const Outer = Action("Outer", Distribution.Multicast);
const Inner = Action("Inner", Distribution.Multicast);
const TestScope = Action("Test", Distribution.Multicast);
const Forwarding = Action("Forwarding", Distribution.Multicast);
const Naming = Action("Naming", Distribution.Multicast);
const Anon = Action("Anon", Distribution.Multicast);
const Children = Action("Children", Distribution.Multicast);

function ScopeReader() {
  const scope = useScope();
  const names = scope
    ? Array.from(scope.values())
        .map((entry) => {
          const id = entry.action;
          if (typeof id === "symbol") {
            const description = id.description ?? "";
            return description.slice(description.lastIndexOf("/") + 1);
          }
          return String(id);
        })
        .join(",")
    : "none";
  return <div data-testid="scope-names">{names}</div>;
}

describe("withScope", () => {
  it("should wrap the component in a Scope provider", () => {
    function Inner() {
      return <ScopeReader />;
    }

    const Wrapped = withScope(TestScope, Inner);

    render(<Wrapped />);

    expect(screen.getByTestId("scope-names").textContent).toBe("Test");
  });

  it("should forward props to the wrapped component", () => {
    function Inner(props: { label: string }) {
      return <div data-testid="label">{props.label}</div>;
    }

    const Wrapped = withScope(Forwarding, Inner);

    render(<Wrapped label="Hello" />);

    expect(screen.getByTestId("label").textContent).toBe("Hello");
  });

  it("should nest within an outer scope", () => {
    function InnerComponent() {
      return <ScopeReader />;
    }
    function OuterComponent() {
      const Wrapped = withScope(Inner, InnerComponent);
      return <Wrapped />;
    }

    const WrappedOuter = withScope(Outer, OuterComponent);

    render(<WrappedOuter />);

    expect(screen.getByTestId("scope-names").textContent).toBe("Outer,Inner");
  });

  it("should name the wrapper by prepending 'Scoped' to the component name", () => {
    function Layout() {
      return <div />;
    }

    const Wrapped = withScope(Naming, Layout);

    expect(Wrapped.name).toBe("ScopedLayout");
  });

  it("should fall back to 'ScopedComponent' for anonymous components", () => {
    const Wrapped = withScope(Anon, () => <div />);

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

    const Wrapped = withScope(Children, Inner);

    render(<Wrapped />);

    expect(screen.getByTestId("content").textContent).toBe("Child AChild B");
  });
});
