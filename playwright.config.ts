import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.integration.ts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:5173",
  },
});
