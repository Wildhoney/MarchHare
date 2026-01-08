import { Action, Distribution } from "../library";

export class DistributedActions {
  static Counter = Action<number>(Distribution.Broadcast, "Counter");
}
