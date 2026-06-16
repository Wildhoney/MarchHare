import { parseArgs } from "node:util";
import { config } from "../utils.js";
import type { Flags } from "../types.js";

export type ParsedInvocation = { positionals: string[]; flags: Flags };

function splitNegations(args: readonly string[]): {
  rest: string[];
  negations: Flags;
} {
  return args.reduce<{ rest: string[]; negations: Flags }>(
    (acc, token) =>
      token.startsWith("--no-")
        ? {
            rest: acc.rest,
            negations: { ...acc.negations, [token.slice(5)]: false },
          }
        : { rest: [...acc.rest, token], negations: acc.negations },
    { rest: [], negations: {} },
  );
}

export function parseInvocation(argv: readonly string[]): ParsedInvocation {
  const { rest, negations } = splitNegations(argv);
  const { values, positionals } = parseArgs({
    args: <string[]>rest,
    options: config.options,
    allowPositionals: true,
    strict: false,
    tokens: false,
  });
  return {
    positionals,
    flags: { ...(<Flags>values), ...negations },
  };
}
