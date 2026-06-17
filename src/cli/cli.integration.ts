import { describe, it, beforeAll, afterAll, expect, vi } from "vitest";
import { execSync, spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// Every `it` in this suite shells out to `tsc` / `eslint` against the
// generated project. The first run hits cold type-checker and lint caches
// and exceeds vitest's 5s default — especially in CI.
vi.setConfig({ testTimeout: 60_000 });

const REPO_ROOT = process.cwd();
const MH_BIN = path.join(REPO_ROOT, "dist", "cli", "bin", "mh.js");
const MARCH_HARE_SRC = path.join(REPO_ROOT, "src", "library", "index.ts");

type ProjectState = { tmpRoot: string; projectRoot: string };

const state: ProjectState = { tmpRoot: "", projectRoot: "" };

function ensureCliBuilt(): void {
  execSync("npm run build:cli", { cwd: REPO_ROOT, stdio: "inherit" });
}

function runMh(cwd: string, args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync("node", [MH_BIN, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
}

function bindMarchHare(projectRoot: string): void {
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  const original = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  const compilerOptions = original.compilerOptions ?? {};
  const paths = compilerOptions.paths ?? {};
  const updated = {
    ...original,
    compilerOptions: {
      ...compilerOptions,
      paths: { ...paths, "march-hare": [MARCH_HARE_SRC] },
    },
  };
  fs.writeFileSync(tsconfigPath, JSON.stringify(updated, null, 2));
}

function setupTestProject(): void {
  state.tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mh-cli-"));
  process.on("exit", () => {
    fs.rmSync(state.tmpRoot, { recursive: true, force: true });
  });

  const result = runMh(state.tmpRoot, [
    "init",
    "test-app",
    "--description=Integration test project",
    "--apiBase=https://api.test",
  ]);
  if (result.status !== 0) {
    throw new Error(
      `mh init failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }

  state.projectRoot = path.join(state.tmpRoot, "test-app");
  fs.symlinkSync(
    path.join(REPO_ROOT, "node_modules"),
    path.join(state.projectRoot, "node_modules"),
  );
  bindMarchHare(state.projectRoot);
}

function assertSpawnOk(label: string, result: SpawnSyncReturns<string>): void {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function typecheck(): void {
  const result = spawnSync("npx", ["tsc", "--noEmit", "--skipLibCheck"], {
    cwd: state.projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
  assertSpawnOk("typecheck", result);
}

function lint(): void {
  const result = spawnSync("npx", ["eslint", "src/"], {
    cwd: state.projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
  assertSpawnOk("eslint", result);
}

function expectCommandSucceeds(label: string, args: readonly string[]): void {
  const result = runMh(state.projectRoot, args);
  if (result.status !== 0) {
    throw new Error(
      `'mh ${args.join(" ")}' (${label}) failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  expect(result.stderr).not.toMatch(/ExitPromptError|Prompt was canceled/);
}

describe("mh CLI", () => {
  beforeAll(() => {
    ensureCliBuilt();
    setupTestProject();
  }, 120_000);

  afterAll(() => {
    if (state.tmpRoot) {
      fs.rmSync(state.tmpRoot, { recursive: true, force: true });
    }
  });

  it("init produces a project that typechecks and lints", () => {
    typecheck();
    lint();
  });

  it("app new <page>", () => {
    expectCommandSucceeds("app new", [
      "app",
      "new",
      "dashboard",
      "--tagline=Live metrics",
    ]);
    typecheck();
    lint();
  });

  it("app integration <page>", () => {
    expectCommandSucceeds("app integration", [
      "app",
      "integration",
      "dashboard",
    ]);
    typecheck();
    lint();
  });

  it("app action <page> <name>", () => {
    expectCommandSucceeds("app action", [
      "app",
      "action",
      "dashboard",
      "Refresh",
    ]);
    typecheck();
    lint();
  });

  it("feature new <name> --stateful", () => {
    expectCommandSucceeds("feature new stateful", [
      "feature",
      "new",
      "counter",
      "--stateful",
    ]);
    typecheck();
    lint();
  });

  it("feature unit <feature>", () => {
    expectCommandSucceeds("feature unit", ["feature", "unit", "counter"]);
    typecheck();
    lint();
  });

  it("feature action <feature> <name>", () => {
    expectCommandSucceeds("feature action", [
      "feature",
      "action",
      "counter",
      "Increment",
    ]);
    typecheck();
    lint();
  });

  it("feature new <name> --no-stateful", () => {
    expectCommandSucceeds("feature new presentational", [
      "feature",
      "new",
      "banner",
      "--no-stateful",
    ]);
    typecheck();
    lint();
  });

  it("feature multicast <feature> <name>", () => {
    expectCommandSucceeds("feature multicast", [
      "feature",
      "multicast",
      "counter",
      "Update",
    ]);
    typecheck();
    lint();
  });

  it("shared component <name>", () => {
    expectCommandSucceeds("shared component", ["shared", "component", "card"]);
    typecheck();
    lint();
  });

  it("shared resource <name>", () => {
    expectCommandSucceeds("shared resource", ["shared", "resource", "profile"]);
    typecheck();
    lint();
  });

  it("shared util <name>", () => {
    expectCommandSucceeds("shared util", ["shared", "util", "format-date"]);
    typecheck();
    lint();
  });

  it("shared type payload <name>", () => {
    expectCommandSucceeds("shared type payload", [
      "shared",
      "type",
      "payload",
      "user-summary",
    ]);
    typecheck();
    lint();
  });

  it("shared type broadcast <name>", () => {
    expectCommandSucceeds("shared type broadcast", [
      "shared",
      "type",
      "broadcast",
      "user-event",
    ]);
    typecheck();
    lint();
  });

  it("shared unit <kind> <name>", () => {
    expectCommandSucceeds("shared unit", [
      "shared",
      "unit",
      "components",
      "card",
    ]);
    typecheck();
    lint();
  });
});
