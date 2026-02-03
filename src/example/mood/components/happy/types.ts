import { Action } from "../../../../library/index.ts";
import { Mood, MulticastActions } from "../../types.ts";

export class Actions {
  static Multicast = MulticastActions;

  static Select = Action<Mood>("Select");
}
