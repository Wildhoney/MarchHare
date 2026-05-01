import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import * as React from "react";
import { Boundary } from "../../../../library/index.ts";
import { Cat } from "./index.tsx";

const fakeCat = {
  id: "abc",
  url: "https://example.com/cat.jpg",
  width: 100,
  height: 100,
};

beforeEach(() => {
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

function renderCat(index: number) {
  return render(
    <Boundary>
      <Cat index={index} />
    </Boundary>,
  );
}

describe("Cat", () => {
  it("renders the heading for the given index", () => {
    renderCat(2);
    expect(screen.getByRole("heading", { name: /Cat #3/ })).toBeTruthy();
  });

  it("loads and displays the fetched cat image", async () => {
    renderCat(0);
    await waitFor(() => {
      expect(screen.getByRole("img").getAttribute("src")).toBe(fakeCat.url);
    });
  });

  it("disables Previous on index 0", async () => {
    renderCat(0);
    await waitFor(() => screen.getByRole("img"));
    expect(
      screen.getByRole("button", { name: /Previous/ }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("enables Previous when index > 0", async () => {
    renderCat(2);
    await waitFor(() => screen.getByRole("img"));
    expect(
      screen.getByRole("button", { name: /Previous/ }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("navigates to the next index when Next is clicked", async () => {
    renderCat(2);
    await waitFor(() => screen.getByRole("img"));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(window.navigation.navigate).toHaveBeenCalledWith("/3", {
      history: "auto",
    });
  });

  it("navigates to the previous index when Previous is clicked", async () => {
    renderCat(2);
    await waitFor(() => screen.getByRole("img"));
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(window.navigation.navigate).toHaveBeenCalledWith("/1", {
      history: "auto",
    });
  });
});
