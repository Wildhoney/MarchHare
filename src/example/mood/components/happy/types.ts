import { Action } from "../../../../library/index.ts";
import { Mood } from "../../types.ts";

export class Actions {
  static Select = Action<Mood>("Select");
}
