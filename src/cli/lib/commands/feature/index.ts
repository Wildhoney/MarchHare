import path from "node:path";
import kleur from "kleur";
import { pascalCase } from "change-case";
import { scaffold } from "../../runner/index.js";
import {
  askName,
  askConfirm,
  pickDirectory,
  requireProjectRoot,
} from "../../prompt/index.js";
import type { CommandArgs, Flags } from "../../types.js";

async function resolveStateful(flags: Flags): Promise<boolean> {
  if (flags.stateful !== undefined) return flags.stateful !== false;
  if (flags.presentational !== undefined) return flags.presentational === false;
  return askConfirm("Does this feature own state and actions?", true);
}

export async function newFeature({
  positional,
  flags,
}: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const name = positional[0] || (await askName("Feature name (kebab-case)"));
  const stateful = await resolveStateful(flags);
  const action = stateful ? "stateful" : "presentational";

  await scaffold(
    "feature",
    action,
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );

  console.log(
    kleur.green("\n  Feature ready."),
    kleur.dim(`Mount it inside a page with <${pascalCase(name)} />.`),
  );
}

export async function unit({ positional }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const featuresRoot = path.join(root, "src", "features");
  const name = positional[0] || (await pickDirectory("feature", featuresRoot));

  await scaffold(
    "feature",
    "unit",
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );
}

export async function action({
  positional,
  flags,
}: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const featuresRoot = path.join(root, "src", "features");
  const feature =
    positional[0] || (await pickDirectory("feature", featuresRoot));
  const name =
    positional[1] ||
    (typeof flags.name === "string" ? flags.name : undefined) ||
    (await askName("Action name (PascalCase)"));

  await scaffold(
    "feature",
    "action",
    {
      feature,
      name: pascalCase(name),
      pascalName: pascalCase(name),
      rawName: name,
    },
    { cwd: root },
  );
}

export async function multicast({
  positional,
  flags,
}: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const featuresRoot = path.join(root, "src", "features");
  const feature =
    positional[0] || (await pickDirectory("feature", featuresRoot));
  const name =
    positional[1] ||
    (typeof flags.name === "string" ? flags.name : undefined) ||
    (await askName("Multicast action (PascalCase)"));

  await scaffold(
    "feature",
    "multicast",
    {
      feature,
      featurePascal: pascalCase(feature),
      name: pascalCase(name),
      pascalName: pascalCase(name),
      rawName: name,
    },
    { cwd: root },
  );
}
