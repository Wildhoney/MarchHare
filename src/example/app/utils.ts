import { App } from "march-hare";
import { Env, Omnicast } from "@example/shared/types/index.ts";

export const app = App<Env.Cat>({
  env: { apiBase: "https://api.thecatapi.com/v1" },
  sse: { url: "http://localhost:8080", actions: Omnicast },
});
