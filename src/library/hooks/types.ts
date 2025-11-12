import type { State } from "immertation";

export type Store = State<Record<string, unknown>> | null;
