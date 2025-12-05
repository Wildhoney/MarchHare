import { resolve } from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isExample = mode === "example";

  return {
    plugins: isExample
      ? [
          react({
            babel: {
              plugins: [
                ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
              ],
            },
          }),
          visualizer(),
        ]
      : [
          react({
            babel: {
              plugins: [
                ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
              ],
            },
          }),
          visualizer(),
          dts({
            include: ["src/library"],
            outDir: "dist",
            entryRoot: "src/library",
          }),
        ],
    build: isExample
      ? {
          // Example build configuration
          outDir: "dist-example",
          rollupOptions: {
            input: {
              main: resolve(__dirname, "index.html"),
            },
          },
        }
      : {
          // Library build configuration
          lib: {
            entry: resolve(__dirname, "src/library/index.ts"),
            name: "Chizu",
            fileName: "chizu",
            formats: ["es", "umd"],
          },
          rollupOptions: {
            external(id) {
              return [
                "@mobily/ts-belt",
                "eventemitter3",
                "immer",
                "immertation",
                "lodash",
                "react",
                "react-dom",
                "traverse",
              ].some((pkg) => id === pkg || id.startsWith(pkg + "/"));
            },
            output: {
              globals: {
                "@mobily/ts-belt": "TsBelt",
                eventemitter3: "EventEmitter3",
                immer: "Immer",
                immertation: "Immertation",
                lodash: "_",
                react: "React",
                "react-dom": "ReactDOM",
                traverse: "Traverse",
              },
            },
          },
        },
  };
});
