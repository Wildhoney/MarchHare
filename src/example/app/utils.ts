import { App } from "march-hare";
import { Env } from "@example/shared/types/index.ts";

export const app = App<Env.Cat>({
  env: { apiBase: "https://api.thecatapi.com/v1" },
});
