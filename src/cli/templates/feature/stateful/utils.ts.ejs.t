---
to: src/features/<%= name %>/utils.ts
---
import { shared } from "march-hare";
import { type Envs } from "@shared/types/index.ts";
import type { Multicast } from "./types.ts";

export const scope = shared.Scope<Envs, typeof Multicast>();
