export type Frontmatter = {
  to?: string;
  if?: string;
  force?: string;
  inject?: string | boolean;
  before?: string;
  after?: string;
  skip_if?: string;
};

export type Helpers = {
  kebab: (input: string) => string;
  pascal: (input: string) => string;
  camel: (input: string) => string;
  title: (input: string) => string;
};

export type ParsedTemplate = { meta: Frontmatter; body: string };
