import { Action, Distribution } from "../../library/index.ts";

export enum Mood {
  Happy,
  Sad,
}

export type Model = {
  selected: Mood | null;
};

export class MulticastActions {
  static Scope = <const>"mood";
  static Mood = Action<Mood>("Mood", Distribution.Multicast);
}
