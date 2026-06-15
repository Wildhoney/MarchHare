import { shared } from "march-hare";
import { type Envs } from "@example/shared/types/index.ts";
import type { Multicast } from "./types.ts";

export const scope = shared.Scope<Envs, typeof Multicast>();
