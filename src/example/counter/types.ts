import { Action, Lifecycle } from "march-hare";

export type User = {
  name: string;
  age: number;
};

export type Model = {
  user: null | User;
};

export class Actions {
  static Mount = Lifecycle.Mount();
  static User = Action("User");
}
