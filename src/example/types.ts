import { Action, Distribution } from "../library";

export class BroadcastActions {
  static Counter = Action<number>("Counter", Distribution.Broadcast);
}
