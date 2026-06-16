---
to: src/app/pages/home/index.integration.tsx
---
import { describe, expect, it } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { Root } from "@app/index.tsx";

describe("HomePage", () => {
  it("renders the heading", () => {
    render(<Root />);
    expect(screen.getByRole("heading", { name: "<%= title(name) %>" })).toBeInTheDocument();
  });

  it("shows the empty state until the button is clicked", () => {
    render(<Root />);
    expect(screen.getByText(/No greeting yet/)).toBeInTheDocument();
  });

  it("broadcasts a greeting on click", async () => {
    render(<Root />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Say hello/ }));
    });
    await waitFor(() => {
      expect(screen.queryByText(/No greeting yet/)).not.toBeInTheDocument();
    });
  });
});
