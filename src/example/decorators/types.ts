import { createAction } from "../../library/index.ts";

export type Model = {
  value: number;
  log: string[];
  attempts: number;
};

export const Actions = {
  // Supplant tests
  SupplantAction: createAction<void>("SupplantAction"),

  // Debounce tests
  DebounceAction: createAction<void>("DebounceAction"),

  // Throttle tests
  ThrottleAction: createAction<void>("ThrottleAction"),

  // Retry tests
  RetryAction: createAction<void>("RetryAction"),
  ResetRetry: createAction<void>("ResetRetry"),

  // Timeout tests
  TimeoutAction: createAction<void>("TimeoutAction"),

  // Clear log
  ClearLog: createAction<void>("ClearLog"),
};
