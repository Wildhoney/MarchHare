import path from "node:path";
import kleur from "kleur";
import { pascalCase, capitalCase } from "change-case";
import { scaffold } from "../../runner/index.js";
import {
  askName,
  askDescription,
  pickDirectory,
  requireProjectRoot,
} from "../../prompt/index.js";
import type { CommandArgs } from "../../types.js";

export async function newPage({
  positional,
  flags,
}: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const name = positional[0] || (await askName("Page name (kebab-case)"));
  const heading =
    (typeof flags.heading === "string" ? flags.heading : undefined) ||
    capitalCase(name);
  const tagline =
    (typeof flags.tagline === "string" ? flags.tagline : undefined) ||
    (await askDescription("Page tagline", `Welcome to ${heading}`));

  await scaffold(
    "app",
    "page",
    { name, heading, tagline, pascalName: pascalCase(name) },
    { cwd: root },
  );

  console.log(
    kleur.green("\n  Page ready."),
    kleur.dim(
      `Wire it up in src/app/index.tsx with <${pascalCase(name)}Page />.`,
    ),
  );
}

export async function integration({ positional }: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const pagesRoot = path.join(root, "src", "app", "pages");
  const name = positional[0] || (await pickDirectory("page", pagesRoot));

  await scaffold(
    "app",
    "integration",
    { name, pascalName: pascalCase(name) },
    { cwd: root },
  );

  console.log(
    kleur.green("\n  Integration test added."),
    kleur.dim(`Run with \`make integration\` or \`npx playwright test\`.`),
  );
}

export async function action({
  positional,
  flags,
}: CommandArgs): Promise<void> {
  const root = requireProjectRoot();
  const pagesRoot = path.join(root, "src", "app", "pages");
  const page = positional[0] || (await pickDirectory("page", pagesRoot));
  const name =
    positional[1] ||
    (typeof flags.name === "string" ? flags.name : undefined) ||
    (await askName("Action name (PascalCase)"));

  await scaffold(
    "app",
    "action",
    {
      page,
      name: pascalCase(name),
      pascalName: pascalCase(name),
      rawName: name,
    },
    { cwd: root },
  );

  console.log(
    kleur.green("\n  Action added."),
    kleur.dim(`Dispatch with actions.dispatch(Actions.${pascalCase(name)}).`),
  );
}
