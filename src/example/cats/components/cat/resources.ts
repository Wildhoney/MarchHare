import ky from "ky";
import { Cache, shared } from "march-hare";
import { Cat, type Env } from "./types.ts";

const cache = Cache({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
  clear: () => localStorage.clear(),
});

export const cat = shared.Resource.Cachable<Env, Cat.Response, Cat.Payload>(
  cache,
  async (context) => {
    const cats = await ky
      .get("https://api.thecatapi.com/v1/images/search", {
        signal: context.controller.signal,
      })
      .json<Cat.Response[]>();
    return cats[0];
  },
);
