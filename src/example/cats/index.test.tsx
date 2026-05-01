import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import Cats from "./index.tsx";

const fakeCat = {
  id: "abc",
  url: "https://example.com/cat.jpg",
  width: 100,
  height: 100,
};

beforeEach(() => {
  window.history.replaceState(null, "", "/cats/0");
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      navigate: vi.fn(),
      currentEntry: { index: 0 },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify([fakeCat]), {
          headers: { "Content-Type": "application/json" },
        }),
    ),
  );
});

describe("Cats", () => {
  it("renders the cat for the URL index", async () => {
    render(<Cats />);
    expect(screen.getByRole("heading", { name: /Cat #1/ })).toBeTruthy();
    await waitFor(() => {
      const img = screen.getByRole("img");
      expect(img.getAttribute("src")).toBe(fakeCat.url);
    });
  });
});
