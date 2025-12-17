import { createAction } from "../../library/index.ts";

export type Model = {
  count: number;
};

export class Actions {
  static Reset = createAction<number>("Reset");
  static Increment = createAction("Increment");
  static Decrement = createAction("Decrement");
}
