---
to: src/shared/components/button/index.test.tsx
---
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./index.tsx";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });
});
