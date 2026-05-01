import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["tests/**/*"],
    setupFiles: ["./src/test-setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    server: {
      deps: {
        inline: ["lodash", "immertation"],
      },
    },
  },
});
