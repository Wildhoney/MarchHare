import path from "node:path";
import process from "node:process";
import kleur from "kleur";
import { pascalCase } from "change-case";
import { scaffold } from "../../runner/index.js";
import { askName, askDescription } from "../../prompt/index.js";
import type { CommandArgs } from "../../types.js";

export async function run({ positional, flags }: CommandArgs): Promise<void> {
  const rawName =
    positional[0] ||
    (typeof flags.name === "string" ? flags.name : undefined) ||
    (await askName("Project name", "my-app"));

  const description =
    (typeof flags.description === "string" ? flags.description : undefined) ||
    (await askDescription(
      "Short description",
      `A March Hare project: ${rawName}`,
    ));

  const apiBase =
    (typeof flags.apiBase === "string" ? flags.apiBase : undefined) ||
    (await askDescription("Default API base URL", "https://api.example.com"));

  const cwd = path.resolve(process.cwd(), rawName);
  const env = pascalCase(rawName);

  console.log();
  console.log(
    kleur.bold(
      `  Scaffolding ${kleur.magenta(rawName)} into ${kleur.gray(cwd)}`,
    ),
  );
  console.log();

  await scaffold(
    "init",
    "new",
    { name: rawName, description, apiBase, env },
    { cwd },
  );

  console.log();
  console.log(kleur.green("  Project ready."));
  console.log();
  console.log(kleur.bold("  Next steps:"));
  console.log(`    cd ${rawName}`);
  console.log("    yarn install");
  console.log("    yarn dev");
  console.log();
}
