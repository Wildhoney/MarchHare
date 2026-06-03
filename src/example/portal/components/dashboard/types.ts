import { Action, Maybe } from "march-hare";

export type Model = {
  user: Maybe<string>;
};

export class Actions {
  static SignIn = Action();
  static SignOut = Action();
}
