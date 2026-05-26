import { Action, Lifecycle } from "march-hare";
import type { Router } from "react-wayfinder";

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

export type Props = { index: number };

export type Data = Props & { router: Router };
