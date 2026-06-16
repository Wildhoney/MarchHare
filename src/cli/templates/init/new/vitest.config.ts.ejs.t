---
to: vitest.config.ts
---
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app": resolve(__dirname, "src/app"),
      "@features": resolve(__dirname, "src/features"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.integration.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
