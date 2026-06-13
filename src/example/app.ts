import { App, Cache } from "march-hare";
import { Status } from "./portal/types.ts";

export const app = App({
  env: {
    status: Status.Guest,
  },
  cache: Cache({
    get: (key) => localStorage.getItem(key),
    set: (key, value) => localStorage.setItem(key, value),
    remove: (key) => localStorage.removeItem(key),
    clear: () => localStorage.clear(),
  }),
});
