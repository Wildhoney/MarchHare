#!/usr/bin/env node
import process from "node:process";
import { main } from "../lib/index.js";

main(process.argv.slice(2)).catch((error: unknown) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exit(130);
  }
  console.error(error);
  process.exit(1);
});
