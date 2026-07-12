import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { Temporal as Polyfill } from "@js-temporal/polyfill";

// Tests run on Node, which does not yet expose `Temporal` globally.
// The library code assumes the host runtime provides it, so install the
// polyfill here before any module that references `Temporal` is loaded.
type TemporalGlobal = { Temporal: typeof globalThis.Temporal };
if (typeof (<Partial<TemporalGlobal>>globalThis).Temporal === "undefined") {
  // eslint-disable-next-line fp/no-mutation
  (<TemporalGlobal>globalThis).Temporal = <typeof globalThis.Temporal>(
    (<unknown>Polyfill)
  );
}

// jsdom does not implement `EventSource`. The SSE bridge only needs the
// constructor surface when components mount during tests — no events are
// ever emitted, so connections stay silent and the client id stays null.
class EventSourceStub {
  addEventListener(): void {}
  close(): void {}
}
type EventSourceGlobal = { EventSource: typeof globalThis.EventSource };
if (
  typeof (<Partial<EventSourceGlobal>>globalThis).EventSource === "undefined"
) {
  // eslint-disable-next-line fp/no-mutation
  (<EventSourceGlobal>globalThis).EventSource = <typeof globalThis.EventSource>(
    (<unknown>EventSourceStub)
  );
}

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});
