import ky from "ky";
import { Resource } from "../../../../library/index.ts";
import type { Cat } from "./types.ts";

export const resources = {
  cat: Resource(async (signal) => {
    const cats = await ky
      .get("https://api.thecatapi.com/v1/images/search", { signal })
      .json<Cat[]>();
    return cats[0];
  }),
};
