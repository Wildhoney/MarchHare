import { Action, Distribution } from "../library";

export  class DistributedActions {
  static Counter = Action<number>("Counter", Distribution.Broadcast);
}
