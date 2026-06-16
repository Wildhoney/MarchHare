import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { input, select, confirm } from "@inquirer/prompts";
import kleur from "kleur";
import { findUpSync } from "find-up";
import { kebabCase } from "change-case";
import { config } from "../utils.js";

export async function askName(
  message: string,
  fallback?: string,
): Promise<string> {
  const value = await input({
    message,
    default: fallback,
    validate: (raw) => {
      const slug = kebabCase(raw);
      if (!slug) return "Name is required";
      if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
        return "Use lowercase letters, digits and hyphens (e.g. add-cat)";
      }
      return true;
    },
  });
  return kebabCase(value);
}

export async function askDescription(
  message: string,
  fallback = "",
): Promise<string> {
  return input({ message, default: fallback });
}

export async function askConfirm(
  message: string,
  def = true,
): Promise<boolean> {
  return confirm({ message, default: def });
}

export async function pickDirectory(
  label: string,
  root: string,
): Promise<string> {
  if (!fs.existsSync(root)) {
    throw new Error(
      `${label} root not found: ${root}. Run \`mh init <name>\` first.`,
    );
  }

  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();

  if (entries.length === 0) {
    throw new Error(
      `No ${label} found under ${path.relative(process.cwd(), root)}.`,
    );
  }

  return select({
    message: `Pick a ${label}`,
    choices: entries.map((name) => ({ name, value: name })),
  });
}

export function findProjectRoot(
  startCwd: string = process.cwd(),
): string | null {
  const marker = findUpSync(
    (directory) =>
      config.projectMarkers.every((relative) =>
        fs.existsSync(path.join(directory, relative)),
      )
        ? directory
        : undefined,
    { cwd: startCwd, type: "directory" },
  );
  return marker ?? null;
}

export function requireProjectRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error(
      kleur.red(
        "Could not find a March Hare project root. Run inside a project created with `mh init <name>`.",
      ),
    );
    process.exit(1);
  }
  return root;
}
