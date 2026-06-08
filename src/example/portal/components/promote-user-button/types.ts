import { Action } from "march-hare";

export type Model = {
  busy: boolean;
};

export class Actions {
  static Click = Action();
}
