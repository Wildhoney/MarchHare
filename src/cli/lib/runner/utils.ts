import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import ejs from "ejs";
import { kebabCase, pascalCase, camelCase, capitalCase } from "change-case";
import type { Frontmatter, Helpers, ParsedTemplate } from "./types.js";

export const helpers: Helpers = {
  kebab: kebabCase,
  pascal: pascalCase,
  camel: camelCase,
  title: capitalCase,
};

export function parseTemplate(source: string): ParsedTemplate {
  const parsed = matter(source, { delimiters: ["---", "---"] });
  return {
    meta: <Frontmatter>parsed.data,
    body: parsed.content.replace(/^\n/, ""),
  };
}

export function isTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === "yes";
}

export function renderCondition(
  expr: string | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!expr) return true;
  return isTruthy(ejs.render(`<%= ${expr} %>`, data));
}

export function renderForce(
  expr: string | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!expr) return false;
  return isTruthy(ejs.render(`<%= ${expr} %>`, data));
}

export function writeFile(target: string, content: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

export function injectInto(
  target: string,
  content: string,
  meta: Frontmatter,
  data: Record<string, unknown>,
): void {
  if (!fs.existsSync(target)) {
    writeFile(target, content);
    return;
  }

  const original = fs.readFileSync(target, "utf8");

  if (meta.skip_if) {
    const pattern = new RegExp(ejs.render(meta.skip_if, data), "m");
    if (pattern.test(original)) return;
  }

  if (meta.after) {
    const pattern = new RegExp(ejs.render(meta.after, data), "m");
    const updated = original.replace(
      pattern,
      (match) => `${match}\n${content}`,
    );
    fs.writeFileSync(target, updated, "utf8");
    return;
  }

  if (meta.before) {
    const pattern = new RegExp(ejs.render(meta.before, data), "m");
    const updated = original.replace(
      pattern,
      (match) => `${content}\n${match}`,
    );
    fs.writeFileSync(target, updated, "utf8");
    return;
  }

  fs.writeFileSync(target, `${original}\n${content}`, "utf8");
}
