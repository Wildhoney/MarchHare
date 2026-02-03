import { Action } from "../../library/index.ts";
import { BroadcastActions } from "../types.ts";

export type Model = {
  count: number;
};

export class Actions {
  static Broadcast = BroadcastActions;

  static Increment = Action("Increment");
  static Decrement = Action("Decrement");
}
