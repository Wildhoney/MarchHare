/**
 * @fileoverview Unit tests for the Mood component.
 *
 * Demonstrates testing patterns for multicast actions:
 * - Sibling components communicate via `<Scope>` boundary
 * - Clicking one card dispatches a multicast that updates both components
 * - The inactive style (opacity: 0.5) indicates a non-selected mood
 * - Tests verify cross-component state synchronisation without explicit wiring
 */
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Mood } from "./types.ts";
import { isInactive } from "./utils.ts";
import MoodComponent from "./index.tsx";

describe("isInactive utility", () => {
  it("should return false when nothing is selected", () => {
    expect(isInactive(null, Mood.Happy)).toBe(false);
    expect(isInactive(null, Mood.Sad)).toBe(false);
  });

  it("should return false when the mood matches selection", () => {
    expect(isInactive(Mood.Happy, Mood.Happy)).toBe(false);
    expect(isInactive(Mood.Sad, Mood.Sad)).toBe(false);
  });

  it("should return true when a different mood is selected", () => {
    expect(isInactive(Mood.Happy, Mood.Sad)).toBe(true);
    expect(isInactive(Mood.Sad, Mood.Happy)).toBe(true);
  });
});

describe("Mood", () => {
  it("should render Happy and Sad cards", () => {
    render(<MoodComponent />);
    expect(screen.getByText("Happy")).toBeInTheDocument();
    expect(screen.getByText("Sad")).toBeInTheDocument();
  });

  it("should render mood emojis", () => {
    render(<MoodComponent />);
    expect(screen.getByText("😊")).toBeInTheDocument();
    expect(screen.getByText("😢")).toBeInTheDocument();
  });

  it("should not be inactive initially", () => {
    render(<MoodComponent />);
    const happy = screen.getByText("Happy").parentElement;
    const sad = screen.getByText("Sad").parentElement;
    expect(happy).not.toHaveStyle({ opacity: "0.5" });
    expect(sad).not.toHaveStyle({ opacity: "0.5" });
  });

  it("should make Sad inactive when Happy is clicked", async () => {
    render(<MoodComponent />);
    const happy = screen.getByText("Happy").parentElement;
    const sad = screen.getByText("Sad").parentElement;
    await act(async () => happy?.click());
    expect(happy).not.toHaveStyle({ opacity: "0.5" });
    expect(sad).toHaveStyle({ opacity: "0.5" });
  });

  it("should make Happy inactive when Sad is clicked", async () => {
    render(<MoodComponent />);
    const happy = screen.getByText("Happy").parentElement;
    const sad = screen.getByText("Sad").parentElement;
    await act(async () => sad?.click());
    expect(sad).not.toHaveStyle({ opacity: "0.5" });
    expect(happy).toHaveStyle({ opacity: "0.5" });
  });

  it("should switch selection between moods", async () => {
    render(<MoodComponent />);
    const happy = screen.getByText("Happy").parentElement;
    const sad = screen.getByText("Sad").parentElement;
    await act(async () => happy?.click());
    expect(sad).toHaveStyle({ opacity: "0.5" });
    await act(async () => sad?.click());
    expect(happy).toHaveStyle({ opacity: "0.5" });
    expect(sad).not.toHaveStyle({ opacity: "0.5" });
    await act(async () => happy?.click());
    expect(sad).toHaveStyle({ opacity: "0.5" });
    expect(happy).not.toHaveStyle({ opacity: "0.5" });
  });
});
