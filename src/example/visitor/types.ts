import { createAction } from "../../library/index.ts";

export type Country = {
  name: string;
  flag: string;
  code: string;
  timestamp: number;
};

export type Model = {
  visitor: Country | null;
  history: Country[];
  source: EventSource | null;
  connected: boolean;
};

export class Actions {
  static Visitor = createAction<Country>("Visitor");
}

export type Action = [Model, typeof Actions];
