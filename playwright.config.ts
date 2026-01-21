import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.integration.ts",
  use: {
    baseURL: "http://localhost:5999",
  },
  webServer: {
    command: "npx vite dev --port 5999",
    port: 5999,
    reuseExistingServer: !process.env.CI,
  },
});
