import { createAction } from "../../library/index.ts";

export type Model = {
  value: number;
  log: string[];
  attempts: number;
};

export class Actions {
  static SupplantAction = createAction<void>("SupplantAction");
  static DebounceAction = createAction<void>("DebounceAction");
  static ThrottleAction = createAction<void>("ThrottleAction");
  static RetryAction = createAction<void>("RetryAction");
  static ResetRetry = createAction<void>("ResetRetry");
  static TimeoutAction = createAction<void>("TimeoutAction");
  static ClearLog = createAction<void>("ClearLog");
}
