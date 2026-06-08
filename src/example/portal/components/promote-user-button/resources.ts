import ky from "ky";
import { app } from "../../../app.ts";

export const promoteUser = app.Resource<void>((context) =>
  ky
    .get("https://httpbin.org/status/500", {
      signal: context.controller.signal,
    })
    .json<void>(),
);
