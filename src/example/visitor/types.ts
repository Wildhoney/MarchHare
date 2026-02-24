import { Action, Lifecycle } from "../../library/index.ts";
import { BroadcastActions } from "../types.ts";

export type Country = {
  name: string;
  flag: string;
  code: string;
  timestamp: number;
};

export type Model = {
  visitor: Country | null;
  history: Country[];
  source: EventSource | null;
  connected: boolean;
};

export class Actions {
  static Mount = Lifecycle.Mount();
  static Unmount = Lifecycle.Unmount();
  static Broadcast = BroadcastActions;

  static Visitor = Action<Country>("Visitor");
}
