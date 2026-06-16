import fs from "node:fs";
import path from "node:path";
import kleur from "kleur";
import { select } from "@inquirer/prompts";
import { pascalCase } from "change-case";
import { scaffold } from "../../runner/index.js";
import {
  askName,
  pickDirectory,
  requireProjectRoot,
} from "../../prompt/index.js";
import type { CommandArgs } from "../../types.js";

const sharedSubdirs: Record<string, string> = {
  components: "component",
  resources: "resource",
  utils: "util",
};

export async function component({ positional }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const name = positional[0] || (await askName("Component name (kebab-case)"));
  await scaffold(
    "shared",
    "component",
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );
}

export async function resource({ positional }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const name = positional[0] || (await askName("Resource name (kebab-case)"));
  await scaffold(
    "shared",
    "resource",
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );

  console.log(
    kleur.dim(
      `\n  Remember to re-export from src/shared/resources/index.ts: export * as ${name.replace(/-/g, "")} from "./${name}/index.ts";`,
    ),
  );
}

export async function util({ positional }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const name = positional[0] || (await askName("Util name (kebab-case)"));
  await scaffold(
    "shared",
    "util",
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );
}

export async function type({ positional, flags }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const kind =
    positional[0] ||
    (typeof flags.kind === "string" ? flags.kind : undefined) ||
    (await select({
      message: "Kind of type to add",
      choices: [
        { name: "Payload — cross-feature data type", value: "payload" },
        { name: "Broadcast — global action class", value: "broadcast" },
      ],
    }));
  const name = positional[1] || (await askName(`${kind} name (kebab-case)`));

  await scaffold(
    "shared",
    `type-${kind}`,
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );
}

export async function unit({ positional }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const sharedRoot = path.join(root, "src", "shared");

  const kindKey =
    positional[0] ||
    (await select({
      message: "Which kind of shared module?",
      choices: Object.keys(sharedSubdirs)
        .filter((key) => fs.existsSync(path.join(sharedRoot, key)))
        .map((key) => ({ name: key, value: key })),
    }));

  const dir = path.join(sharedRoot, kindKey);
  const name = positional[1] || (await pickDirectory(kindKey, dir));

  await scaffold(
    "shared",
    `unit-${sharedSubdirs[kindKey]}`,
    { name, pascalName: pascalCase(name), kind: kindKey },
    { cwd: root },
  );
}
