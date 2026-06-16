export type Flags = Record<string, string | boolean | undefined>;

export type CommandArgs = { positional: string[]; flags: Flags };

export type CommandHandler = (args: CommandArgs) => Promise<void>;

export type LeafNode = {
  leaf: true;
  description: string;
  run: CommandHandler;
};

export type BranchNode = {
  leaf: false;
  description: string;
  children: Record<string, TreeNode>;
};

export type TreeNode = LeafNode | BranchNode;

export type Tree = Record<string, TreeNode>;

export type ScaffoldVars = Record<string, string | number | boolean>;

export type ScaffoldResult = {
  written: string[];
  skipped: string[];
  injected: string[];
};
