import { Action } from "march-hare";
import { Mood } from "../../types.ts";

export class Actions {
  static Select = Action<Mood>("Select");
}
