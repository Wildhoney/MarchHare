import { Action } from "../../library/index.ts";

export type Model = {
  value: number;
  log: string[];
  attempts: number;
};

export class Actions {
  static Supplant = Action("Supplant");
  static Debounce = Action("Debounce");
  static Throttle = Action("Throttle");
  static Retry = Action("Retry");
  static Reset = Action("Reset");
  static Timeout = Action("Timeout");
  static Clear = Action("Clear");
}
