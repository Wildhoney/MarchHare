import { createAction } from "../../library/index.ts";
import { DistributedActions } from "../types.ts";

export type Model = {
  count: number;
};

export class Actions extends DistributedActions {
  static Increment = createAction("Increment");
  static Decrement = createAction("Decrement");
}
