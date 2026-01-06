import { createAction } from "../../library/index.ts";

export type Model = {
  value: number;
  log: string[];
  attempts: number;
};

export class Actions {
  static Supplant = createAction<void>("Supplant");
  static Debounce = createAction<void>("Debounce");
  static Throttle = createAction<void>("Throttle");
  static Retry = createAction<void>("Retry");
  static Reset = createAction<void>("Reset");
  static Timeout = createAction<void>("Timeout");
  static Clear = createAction<void>("Clear");
}

export type Action = [Model, typeof Actions];
