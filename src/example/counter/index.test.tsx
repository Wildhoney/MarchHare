import { describe, expect, it } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { Boundary } from "march-hare";
import Counter from "./index.tsx";

describe("Counter", () => {
  it("renders the user after mount", async () => {
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("Adam"),
    );
  });

  it("re-renders the user when the refresh button is clicked", async () => {
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("Adam"),
    );
    await act(async () => screen.getByTestId("refresh").click());
    expect(screen.getByTestId("user").textContent).toBe("Adam");
  });
});
