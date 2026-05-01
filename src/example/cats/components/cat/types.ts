import { Action, Lifecycle } from "../../../../library/index.ts";
import type { RouterHandle } from "react-wayfinder";

export type Cat = {
  id: string;
  url: string;
  width: number;
  height: number;
};

export class Actions {
  static Mount = Lifecycle.Mount();

  static Next = Action("Next");
  static Previous = Action("Previous");
  static Refresh = Action("Refresh");
}

export type Model = {
  cat: Cat | null;
};

export type Data = { index: number; router: RouterHandle };
