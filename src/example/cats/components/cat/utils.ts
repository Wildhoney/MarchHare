import ky from "ky";
import { Cache, Resource } from "march-hare";
import type { Cat, H } from "./types.ts";

const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const cat = Resource.Cachable(cache, async (context) => {
  const cats = await ky
    .get("https://api.thecatapi.com/v1/images/search", {
      signal: context.controller.signal,
    })
    .json<Cat[]>();
  return cats[0];
});

export const getCat: H["Get"] = async (context) => {
  const data = await context.actions
    .resource(cat({ id: 5 }))
    .exceeds({ minutes: 5 });
  context.actions.produce(({ model }) => void (model.cat = data));
};
