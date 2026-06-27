import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Broadcaster, useBroadcast } from "./index";
import { BroadcastEmitter } from "./utils.ts";
import EventEmitter from "eventemitter3";

function TestComponent() {
  const broadcast = useBroadcast();
  return (
    <div data-testid="has-emitter">
      {String(broadcast instanceof EventEmitter)}
    </div>
  );
}

describe("Broadcaster", () => {
  it("should render children", () => {
    render(
      <Broadcaster>
        <div data-testid="child">Hello</div>
      </Broadcaster>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  it("should provide broadcast context with EventEmitter", () => {
    render(
      <Broadcaster>
        <TestComponent />
      </Broadcaster>,
    );
    expect(screen.getByTestId("has-emitter").textContent).toBe("true");
  });
});

describe("useBroadcast()", () => {
  it("should return default context when not wrapped in Broadcaster", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("has-emitter").textContent).toBe("true");
  });
});

describe("BroadcastEmitter per-channel cache", () => {
  const event = Symbol("test/event");

  it("stores a single entry under the default key for unchannel dispatches", () => {
    const emitter = new BroadcastEmitter();

    emitter.setCache(event, "first", undefined);
    emitter.setCache(event, "second", undefined);

    expect(emitter.getCached(event)).toBe("second");
    const entries = [...emitter.getCachedAll(event)];
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ channel: undefined, value: "second" });
  });

  it("keeps one entry per distinct channel hash and overrides on repeat", () => {
    const emitter = new BroadcastEmitter();

    emitter.setCache(event, "v1", { id: 1 });
    emitter.setCache(event, "v2", { id: 2 });
    emitter.setCache(event, "v1-new", { id: 1 });

    const entries = [...emitter.getCachedAll(event)];
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ channel: { id: 1 }, value: "v1-new" });
    expect(entries).toContainEqual({ channel: { id: 2 }, value: "v2" });
  });

  it("returns the most recent entry across channels from getCached()", () => {
    const emitter = new BroadcastEmitter();

    emitter.setCache(event, "a", { id: 1 });
    emitter.setCache(event, "b", { id: 2 });
    expect(emitter.getCached(event)).toBe("b");

    emitter.setCache(event, "a-2", { id: 1 });
    expect(emitter.getCached(event)).toBe("a-2");
  });

  it("returns an empty iterable for events with no cached entries", () => {
    const emitter = new BroadcastEmitter();
    expect([...emitter.getCachedAll(event)]).toEqual([]);
    expect(emitter.getCached(event)).toBeUndefined();
  });

  it("keeps default and channel entries in disjoint namespaces", () => {
    const emitter = new BroadcastEmitter();

    emitter.setCache(event, "default", undefined);
    emitter.setCache(event, "channeled", { id: 1 });

    const entries = [...emitter.getCachedAll(event)];
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ channel: undefined, value: "default" });
    expect(entries).toContainEqual({ channel: { id: 1 }, value: "channeled" });
  });
});
