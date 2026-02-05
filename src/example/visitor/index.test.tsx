/**
 * @fileoverview Unit tests for the Visitor component.
 *
 * Demonstrates testing patterns for SSE (Server-Sent Events) with Chizu:
 * - Mock `EventSource` to simulate server connections and events
 * - Use `Lifecycle.Mount` to establish connections on component mount
 * - Use `Lifecycle.Unmount` to clean up connections
 * - Component returns null until connected, then shows visitor data
 * - Each visitor event replaces the previous visitor display
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Visitor from "./index.tsx";
import type { Country } from "./types.ts";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners: Record<string, ((event: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, callback: (event: MessageEvent) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  close() {}

  emit(event: string, data?: unknown) {
    const listeners = this.listeners[event] || [];
    listeners.forEach((listener) => {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    });
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static getLatest() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

describe("Visitor", () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should not render until connected", () => {
    render(<Visitor />);
    expect(screen.queryByText("Waiting for visitors")).not.toBeInTheDocument();
  });

  it("should show waiting message after connection", async () => {
    render(<Visitor />);
    const source = MockEventSource.getLatest();
    await act(async () => source.emit("connected"));
    expect(screen.getByText("Waiting for visitors...")).toBeInTheDocument();
  });

  it("should display visitor when event received", async () => {
    render(<Visitor />);
    const source = MockEventSource.getLatest();
    const country: Country = {
      name: "United Kingdom",
      flag: "🇬🇧",
      code: "GB",
      timestamp: Date.now(),
    };
    await act(async () => source.emit("connected"));
    await act(async () => source.emit("visitor", country));
    expect(
      screen.getByText(/🇬🇧.*User visited from United Kingdom/),
    ).toBeInTheDocument();
  });

  it("should update visitor when new event received", async () => {
    render(<Visitor />);
    const source = MockEventSource.getLatest();
    const firstVisitor: Country = {
      name: "France",
      flag: "🇫🇷",
      code: "FR",
      timestamp: Date.now(),
    };
    const secondVisitor: Country = {
      name: "Germany",
      flag: "🇩🇪",
      code: "DE",
      timestamp: Date.now() + 1000,
    };
    await act(async () => source.emit("connected"));
    await act(async () => source.emit("visitor", firstVisitor));
    expect(screen.getByText(/User visited from France/)).toBeInTheDocument();
    await act(async () => source.emit("visitor", secondVisitor));
    expect(screen.getByText(/User visited from Germany/)).toBeInTheDocument();
    expect(screen.queryByText(/France/)).not.toBeInTheDocument();
  });

  it("should connect to /visitors endpoint", () => {
    render(<Visitor />);
    const source = MockEventSource.getLatest();
    expect(source.url).toBe("/visitors");
  });
});
