import { Action, Distribution, Lifecycle } from "../../library/index.ts";
import type { Cat } from "./api.ts";

export class BroadcastActions {
  static CatViewed = Action<string>("CatViewed", Distribution.Broadcast);
}

export type ViewerModel = {
  cat: Cat | null;
};

export class Actions {
  static Broadcast = BroadcastActions;
  static Mount = Lifecycle.Mount();

  static Next = Action("Next");
  static Previous = Action("Previous");
  static Refresh = Action("Refresh");
}

export type SessionModel = {
  viewCount: number;
  history: string[];
};

export class SessionActions {
  static Broadcast = BroadcastActions;
}
