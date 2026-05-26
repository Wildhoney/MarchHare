import { Action, Distribution } from "march-hare";

export class BroadcastActions {
  static Counter = Action<number>("Counter", Distribution.Broadcast);
}
