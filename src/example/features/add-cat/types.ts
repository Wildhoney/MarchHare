import { Action } from "march-hare";
import { Broadcast } from "@example/shared/types/index.ts";

export type Model = {
  pending: boolean;
};

export class Actions {
  static Click = Action("AddCat.Click");
  static Broadcast = Broadcast.Actions;
}
