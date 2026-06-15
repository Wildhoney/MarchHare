import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { Root } from "@example/app/index.tsx";

const cat = {
  id: "abc123",
  url: "https://cdn.example/cat.jpg",
  width: 400,
  height: 400,
};

describe("CatteryPage", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify([cat]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the heading and tagline", () => {
    render(<Root />);
    expect(
      screen.getByRole("heading", { name: "Cattery" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Click the button to adopt a randomly named cat\./),
    ).toBeInTheDocument();
  });

  it("shows the empty state until a cat is adopted", () => {
    render(<Root />);
    expect(screen.getByText(/No cats yet/)).toBeInTheDocument();
  });

  it("renders the add-a-cat button enabled", () => {
    render(<Root />);
    const button = screen.getByRole("button", { name: "Add a cat" });
    expect(button).toBeEnabled();
  });

  it("adopts a cat and appends it to the grid", async () => {
    render(<Root />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add a cat" }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/No cats yet/)).not.toBeInTheDocument();
    });

    const avatar = await screen.findByAltText(/.+/);
    expect(avatar).toHaveAttribute("src", cat.url);
  });
});
