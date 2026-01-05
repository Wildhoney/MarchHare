import { createDistributedAction } from "../library";

export class DistributedActions {
  static Counter = createDistributedAction<number>("Counter");
}
