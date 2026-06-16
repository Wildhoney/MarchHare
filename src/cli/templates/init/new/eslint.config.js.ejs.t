---
to: eslint.config.js
---
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginImport from "eslint-plugin-import";
import pluginBoundaries from "eslint-plugin-boundaries";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    plugins: { import: pluginImport },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "import/no-default-export": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx,d.ts}"],
    plugins: { boundaries: pluginBoundaries },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
        node: true,
      },
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app", mode: "folder" },
        {
          type: "features",
          pattern: "src/features/*",
          mode: "folder",
          capture: ["slice"],
        },
        { type: "shared", pattern: "src/shared", mode: "folder" },
      ],
    },
    rules: {
      "import/no-default-export": "off",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "${file.type} cannot import ${dependency.type} — layering is top-down (app → features → shared).",
          rules: [
            { from: { type: "app" }, allow: { to: { type: ["app", "features", "shared"] } } },
            { from: { type: "features" }, allow: { to: { type: "shared" } } },
            { from: { type: "shared" }, allow: { to: { type: "shared" } } },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.integration.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "eslint.config.js"],
    rules: { "import/no-default-export": "off" },
  },
]);
