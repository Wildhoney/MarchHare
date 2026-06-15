import { shared } from "march-hare";
import ky from "ky";
import { Env } from "../../types/index.ts";
import { Cat } from "./types.ts";

export const image = shared.Resource<Env.Cat, Cat.Response>((context) =>
  ky
    .get(`${context.env.apiBase}/images/search`, {
      signal: context.controller.signal,
    })
    .json<Cat.Response>(),
);
