import { Action } from "../../library/index.ts";
import { DistributedActions } from "../types.ts";

export type Model = {
  count: number;
};

export class Actions extends DistributedActions {
  static Increment = Action("Increment");
  static Decrement = Action("Decrement");
}
