import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginImport from "eslint-plugin-import";
import pluginFp from "eslint-plugin-fp";
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
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.lint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true },
      ],
    },
  },
  pluginReact.configs.flat.recommended,
  {
    plugins: {
      import: pluginImport,
      fp: pluginFp,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-namespace": "off",
      complexity: ["warn", { max: 20 }],
      "import/prefer-default-export": "off",
      "import/no-default-export": "error",
      "fp/no-let": "error",
      "fp/no-mutation": ["error", { commonjs: true }],
      "fp/no-mutating-assign": "error",
      "fp/no-mutating-methods": "error",
      "fp/no-delete": "error",
      "fp/no-loops": "error",
    },
  },
  {
    files: ["src/example/**/*.{ts,tsx,d.ts}"],
    plugins: { boundaries: pluginBoundaries },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.lint.json" },
        node: true,
      },
      "boundaries/include": ["src/example/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/example/app", mode: "folder" },
        {
          type: "features",
          pattern: "src/example/features/*",
          mode: "folder",
          capture: ["slice"],
        },
        { type: "shared", pattern: "src/example/shared", mode: "folder" },
      ],
    },
    rules: {
      "import/prefer-default-export": "off",
      "import/no-default-export": "off",
      "fp/no-mutation": "off",
      "fp/no-let": "off",
      "fp/no-loops": "off",
      "fp/no-mutating-methods": "off",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "${file.type} cannot import ${dependency.type} — layering is top-down (app → features → shared).",
          rules: [
            {
              from: { type: "app" },
              allow: { to: { type: ["app", "features", "shared"] } },
            },
            {
              from: { type: "features" },
              allow: { to: { type: "shared" } },
            },
            { from: { type: "shared" }, allow: { to: { type: "shared" } } },
          ],
        },
      ],
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "**/*.integration.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
    ],
    rules: {
      "fp/no-mutation": "off",
      "fp/no-let": "off",
      "fp/no-loops": "off",
      "fp/no-mutating-methods": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: [
      "src/library/utils/utils.ts",
      "src/library/utils/index.ts",
      "src/library/actions/index.ts",
      "src/library/actions/utils.ts",
      "src/library/context/index.ts",
      "src/library/scope/index.tsx",
      "src/library/with/index.ts",
      "src/library/with/utils.ts",
      "src/library/scope/utils.tsx",
      "src/library/resource/index.ts",
      "src/library/resource/utils.ts",
      "src/library/cache/index.ts",
      "src/library/app/index.tsx",
      "src/library/boundary/components/consumer/components/partition/index.tsx",
      "src/library/boundary/components/tap/index.tsx",
    ],
    rules: {
      "fp/no-mutation": "off",
      "fp/no-let": "off",
      "fp/no-loops": "off",
      "fp/no-mutating-methods": "off",
    },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "angle-bracket" },
      ],
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "as" },
      ],
    },
  },
  {
    files: ["src/library/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "error",
    },
  },
]);
