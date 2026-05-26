import { Action, Distribution } from "march-hare";

export enum Mood {
  Happy,
  Sad,
}

export type Model = {
  selected: Mood | null;
};

export class Scope {
  static Mood = Action<Mood>("Mood", Distribution.Multicast);
}
