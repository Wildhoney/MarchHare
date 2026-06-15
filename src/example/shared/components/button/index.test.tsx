import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./index.tsx";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("respects the loading prop", () => {
    render(<Button loading>Working</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toMatch(/loading/);
  });

  it("forwards onClick to the underlying button", () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Tap</Button>);
    screen.getByRole("button", { name: "Tap" }).click();
    expect(clicked).toBe(true);
  });
});
