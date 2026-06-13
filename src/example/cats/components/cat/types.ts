import { Action, type Handlers, Lifecycle, type Maybe } from "march-hare";
import type { Router } from "react-wayfinder";

export namespace Cat {
  export type Response = {
    id: string;
    url: string;
    width: number;
    height: number;
  };

  export type Payload = { id: number };
}

export class Actions {
  static Mount = Lifecycle.Mount();

  static Next = Action("Next");
  static Previous = Action("Previous");
  static Get = Action("Get");
}

export type Model = {
  cat: Maybe<Cat.Response>;
};

export type Props = { index: number };

export type Data = Props & { router: Router };

export type Handler = Handlers<Model, typeof Actions, Data>;
