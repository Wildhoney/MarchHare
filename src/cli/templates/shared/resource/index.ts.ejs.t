---
to: src/shared/resources/<%= name %>/index.ts
---
import { shared } from "march-hare";
import ky from "ky";
import { type Envs } from "@shared/types/index.ts";
import { <%= pascalName %> } from "./types.ts";

export const fetch = shared.Resource<Envs, <%= pascalName %>.Response>((context) =>
  ky
    .get(`${context.env.apiBase}/<%= name %>`, {
      signal: context.controller.signal,
    })
    .json<<%= pascalName %>.Response>(),
);
