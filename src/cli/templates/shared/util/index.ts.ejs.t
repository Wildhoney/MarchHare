---
to: src/shared/utils/<%= name %>/index.ts
---
export function <%= camel(name) %>(input: string): string {
  return input.trim();
}
