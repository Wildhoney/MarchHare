import ky from "ky";
import { Cache, Resource } from "../../../../library/index.ts";
import type { Cat } from "./types.ts";

const cache = new Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const resources = {
  cat: Resource(async ({ signal }) => {
    const cats = await ky
      .get("https://api.thecatapi.com/v1/images/search", { signal })
      .json<Cat[]>();
    return cats[0];
  }, cache),
};
