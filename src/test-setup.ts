import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Cleanup DOM after each test
afterEach(() => {
  cleanup();
});
