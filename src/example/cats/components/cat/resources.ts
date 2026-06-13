import ky from "ky";
import { app } from "../../../app.ts";
import { Cat } from "./types.ts";

export const cat = app.Resource<Cat.Response, Cat.Payload>(async (context) => {
  const cats = await ky
    .get("https://api.thecatapi.com/v1/images/search", {
      signal: context.controller.signal,
    })
    .json<Cat.Response[]>();
  return cats[0];
});
