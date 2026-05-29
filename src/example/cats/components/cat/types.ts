import { Action, type Handlers, Lifecycle } from "march-hare";
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
  static Get = Action("Get");
}

export type Model = {
  cat: Cat | null;
};

export type Props = { index: number };

export type Data = Props & { router: Router };

export type H = Handlers<Model, typeof Actions, Data>;
