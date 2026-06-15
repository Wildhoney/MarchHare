import { resolve } from "node:path";
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
    alias: {
      "march-hare": resolve(__dirname, "src/library/index.ts"),
      "@example/app": resolve(__dirname, "src/example/app"),
      "@example/features": resolve(__dirname, "src/example/features"),
      "@example/shared": resolve(__dirname, "src/example/shared"),
    },
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
