import { createAction } from "../../library/index.ts";

export type Model = {
  count: number;
};

export class Actions {
  static Increment = createAction("Increment");
  static Decrement = createAction("Decrement");
}
