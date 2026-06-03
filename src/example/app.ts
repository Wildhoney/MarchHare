import { App } from "march-hare";
import { Status } from "./portal/types.ts";

export const app = App({
  env: {
    status: Status.Guest,
  },
});
