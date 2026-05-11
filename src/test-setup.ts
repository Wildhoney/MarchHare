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

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});
