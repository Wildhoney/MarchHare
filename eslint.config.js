import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginImport from "eslint-plugin-import";
import pluginFp from "eslint-plugin-fp";
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
    rules: {
      "import/prefer-default-export": "off",
      "import/no-default-export": "off",
      "fp/no-mutation": "off",
      "fp/no-let": "off",
      "fp/no-loops": "off",
      "fp/no-mutating-methods": "off",
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "fp/no-mutation": "off",
      "fp/no-let": "off",
      "fp/no-loops": "off",
      "fp/no-mutating-methods": "off",
    },
  },
  {
    files: [
      "src/library/utils/utils.ts",
      "src/library/utils/index.ts",
      "src/library/hooks/index.ts",
      "src/library/hooks/utils.ts",
      "src/library/boundary/components/consumer/components/partition/index.tsx",
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
]);
