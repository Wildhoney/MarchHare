---
to: src/app/utils.ts
---
import { App } from "march-hare";
import { Env } from "@shared/types/index.ts";

export const app = App<Env.<%= env %>>({
  env: { apiBase: "<%= apiBase %>" },
});
