import process from "node:process";
import kleur from "kleur";
import { select } from "@inquirer/prompts";
import { banner } from "./banner/index.js";
import { tree } from "./commands/index.js";
import { parseInvocation } from "./parser/index.js";
import type { BranchNode, Flags, Tree, TreeNode } from "./types.js";

async function selectChild(branch: BranchNode): Promise<string> {
  const choices = Object.entries(branch.children).map(([key, child]) => ({
    name: child.leaf
      ? `${kleur.bold(key).padEnd(16)} ${kleur.gray(child.description)}`
      : `${kleur.bold(key).padEnd(16)} ${kleur.gray(`${child.description} ›`)}`,
    value: key,
  }));

  return select({ message: "What would you like to do?", choices });
}

function printTree(branch: BranchNode): void {
  console.log(kleur.dim("Available sub-commands:"));
  Object.entries(branch.children).forEach(([key, child]) => {
    const arrow = child.leaf ? "  " : " ›";
    console.log(
      `  ${kleur.bold(key).padEnd(14)} ${kleur.gray(child.description)}${arrow}`,
    );
  });
}

async function descend(
  node: TreeNode,
  positional: string[],
  flags: Flags,
): Promise<void> {
  if (node.leaf) {
    return node.run({ positional, flags });
  }

  const [next, ...rest] = positional;

  if (next && node.children[next]) {
    return descend(node.children[next], rest, flags);
  }

  if (next) {
    console.error(kleur.red(`Unknown command: ${next}`));
    printTree(node);
    process.exit(1);
  }

  const choice = await selectChild(node);
  return descend(node.children[choice], rest, flags);
}

function rootBranch(children: Tree): BranchNode {
  return { leaf: false, description: "root", children };
}

export async function main(argv: readonly string[]): Promise<void> {
  const { positionals, flags } = parseInvocation(argv);

  if (flags.help || positionals[0] === "help") {
    banner();
    console.log(
      kleur.bold("Usage:"),
      "mh [command] [sub-command] [name] [--flag=value]",
    );
    console.log();
    printTree(rootBranch(tree));
    console.log();
    console.log(
      kleur.dim("Run a command with no name to be prompted interactively."),
    );
    console.log(kleur.dim("Run `mh` alone for a menu of all commands."));
    return;
  }

  banner();
  await descend(rootBranch(tree), [...positionals], flags);
}
