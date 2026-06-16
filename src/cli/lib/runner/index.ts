import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import kleur from "kleur";
import { glob } from "tinyglobby";
import type { ScaffoldResult, ScaffoldVars } from "../types.js";
import {
  helpers,
  parseTemplate,
  renderCondition,
  renderForce,
  writeFile,
  injectInto,
} from "./utils.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const templates = path.resolve(here, "..", "..", "templates");

export async function scaffold(
  generator: string,
  action: string,
  vars: ScaffoldVars,
  { cwd = process.cwd() }: { cwd?: string } = {},
): Promise<ScaffoldResult> {
  const root = path.join(templates, generator, action);
  if (!fs.existsSync(root)) {
    throw new Error(`Unknown generator: ${generator}/${action}`);
  }

  const data: Record<string, unknown> = { ...helpers, h: helpers, ...vars };
  const files = await glob(["**/*.ejs.t"], { cwd: root, absolute: true });

  const initial: ScaffoldResult = { written: [], skipped: [], injected: [] };

  const result = files.reduce<ScaffoldResult>((acc, file) => {
    const raw = fs.readFileSync(file, "utf8");
    const { meta, body } = parseTemplate(raw);
    if (!meta.to) return acc;

    const target = path.resolve(cwd, ejs.render(meta.to, data));
    if (!renderCondition(meta.if, data)) {
      return { ...acc, skipped: [...acc.skipped, path.relative(cwd, target)] };
    }

    const rendered = ejs.render(body, data, { filename: file });

    if (meta.inject) {
      injectInto(target, rendered, meta, data);
      return {
        ...acc,
        injected: [...acc.injected, path.relative(cwd, target)],
      };
    }

    if (fs.existsSync(target) && !renderForce(meta.force, data)) {
      return { ...acc, skipped: [...acc.skipped, path.relative(cwd, target)] };
    }

    writeFile(target, rendered);
    return { ...acc, written: [...acc.written, path.relative(cwd, target)] };
  }, initial);

  result.written.forEach((file) => console.log(kleur.green("    added"), file));
  result.injected.forEach((file) =>
    console.log(kleur.cyan("  injected"), file),
  );
  result.skipped.forEach((file) =>
    console.log(kleur.yellow("   skipped"), file),
  );

  return result;
}
