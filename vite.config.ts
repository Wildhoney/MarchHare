import { resolve } from "node:path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, Plugin } from "vite";
import dts from "vite-plugin-dts";
import react from "@vitejs/plugin-react";

type Country = {
  name: { common: string };
  flag: string;
  cca2: string;
};

function ssePlugin(): Plugin {
  const countries = new Set<Country>();

  // Pre-fetch countries on plugin init
  fetch("https://restcountries.com/v3.1/all?fields=name,flag,cca2")
    .then((response) => response.json())
    .then((data: Country[]) => {
      data.forEach((country) => countries.add(country));
      console.log(`[SSE] Loaded ${countries.size} countries`);
    })
    .catch((err) => console.error("[SSE] Failed to load countries:", err));

  return {
    name: "sse-visitor",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const hasExtension = /\.\w+($|\?)/.test(url);
        const isApi = url.startsWith("/visitors") || url.startsWith("/@");

        if (!hasExtension && !isApi) {
          req.url = "/src/example/index.html";
        }
        next();
      });

      server.middlewares.use("/visitors", (req, res) => {
        console.log("[SSE] Client connected");

        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });

        res.write("event: connected\ndata: {}\n\n");

        const sendVisitor = () => {
          if (countries.size === 0) return;

          const list = [...countries];
          const country = list[Math.floor(Math.random() * list.length)];
          const payload = JSON.stringify({
            name: country.name.common,
            flag: country.flag,
            code: country.cca2,
            timestamp: Date.now(),
          });

          res.write(`event: visitor\ndata: ${payload}\n\n`);
          console.log(
            `[SSE] Visitor from: ${country.name.common} ${country.flag}`,
          );

          // Schedule next visitor with random delay between 1s and 10s
          const delay = Math.floor(Math.random() * 9000) + 1000;
          timeoutId = setTimeout(sendVisitor, delay);
        };

        let timeoutId = setTimeout(sendVisitor, 1000);

        req.on("close", () => {
          console.log("[SSE] Client disconnected");
          clearTimeout(timeoutId);
        });
      });
    },
  };
}

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
          ssePlugin(),
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
          ssePlugin(),
          dts({
            include: ["src/library"],
            outDir: "dist",
            entryRoot: "src/library",
          }),
        ],
    build: isExample
      ? {
          outDir: "dist-example",
          rollupOptions: {
            input: {
              main: resolve(__dirname, "src/example/index.html"),
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
              return ["@mobily/ts-belt", "immer", "react"].some(
                (pkg) => id === pkg || id.startsWith(pkg + "/"),
              );
            },
            output: {
              globals: {
                "@mobily/ts-belt": "TsBelt",
                immer: "Immer",
                react: "React",
              },
            },
          },
        },
  };
});
