/**
 * @fileoverview Unit tests for the Counter component.
 *
 * Demonstrates testing patterns for Chizu components:
 * - Synchronous actions (decrement) update state immediately
 * - Asynchronous actions (increment) show pending state via annotations
 * - Use `vi.useFakeTimers()` to control async timing in tests
 * - Use `act()` to wrap state-changing operations
 * - Check `inspect.count.pending()` state via the loading indicator's opacity
 * - Check `inspect.count.draft()` for optimistic values shown during pending state
 * - Check `inspect.count.remaining()` for the count of in-flight operations
 */
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Boundary } from "../../library/index.ts";
import Counter from "./index.tsx";

describe("Counter", () => {
  it("should render with initial count of 1", () => {
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const count = screen.getByTestId("count");
    expect(count).toHaveAttribute("data-count", "1");
  });

  it("should have increment and decrement buttons", () => {
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "−" })).toBeInTheDocument();
  });

  it("should decrement when minus button clicked", async () => {
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const decrement = screen.getByRole("button", { name: "−" });
    const count = screen.getByTestId("count");
    await act(async () => decrement.click());
    expect(count).toHaveAttribute("data-count", "0");
  });

  it("should decrement multiple times", async () => {
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const decrement = screen.getByRole("button", { name: "−" });
    const count = screen.getByTestId("count");
    await act(async () => decrement.click());
    await act(async () => decrement.click());
    await act(async () => decrement.click());
    expect(count).toHaveAttribute("data-count", "-2");
  });

  it("should show loading indicator when increment clicked", async () => {
    vi.useFakeTimers();
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const increment = screen.getByRole("button", { name: "+" });
    const loading = screen.getByTestId("loading");
    expect(loading).toHaveStyle({ opacity: "0" });
    act(() => increment.click());
    expect(loading).toHaveStyle({ opacity: "1" });
    vi.useRealTimers();
  });

  it("should hide loading indicator after async completes", async () => {
    vi.useFakeTimers();
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const increment = screen.getByRole("button", { name: "+" });
    const loading = screen.getByTestId("loading");
    act(() => increment.click());
    expect(loading).toHaveStyle({ opacity: "1" });
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(loading).toHaveStyle({ opacity: "0" });
    vi.useRealTimers();
  });

  it("should update count after async increment completes", async () => {
    vi.useFakeTimers();
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const increment = screen.getByRole("button", { name: "+" });
    const count = screen.getByTestId("count");
    act(() => increment.click());
    expect(count).toHaveAttribute("data-count", "1");
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(count).toHaveAttribute("data-count", "2");
    vi.useRealTimers();
  });

  it("should show draft value while pending", async () => {
    vi.useFakeTimers();
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const increment = screen.getByRole("button", { name: "+" });
    const loading = screen.getByTestId("loading");
    act(() => increment.click());
    expect(loading.textContent).toContain("next: 2");
    vi.useRealTimers();
  });

  it("should track multiple pending operations", async () => {
    vi.useFakeTimers();
    render(
      <Boundary>
        <Counter />
      </Boundary>,
    );
    const increment = screen.getByRole("button", { name: "+" });
    const loading = screen.getByTestId("loading");
    act(() => {
      increment.click();
      increment.click();
      increment.click();
    });
    expect(loading.textContent).toContain("Remaining: 3");
    expect(loading.textContent).toContain("next: 4");
    vi.useRealTimers();
  });
});
