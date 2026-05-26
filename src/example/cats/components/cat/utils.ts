import ky from "ky";
import { Cache, Resource } from "march-hare";
import type { Cat } from "./types.ts";

const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const cat = Resource(async ({ controller }) => {
  const cats = await ky
    .get("https://api.thecatapi.com/v1/images/search", {
      signal: controller.signal,
    })
    .json<Cat[]>();
  return cats[0];
}, cache);
