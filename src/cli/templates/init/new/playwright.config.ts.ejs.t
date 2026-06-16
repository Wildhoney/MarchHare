---
to: playwright.config.ts
---
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.e2e.ts",
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "vite dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
