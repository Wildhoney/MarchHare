import { Sse } from "march-hare";
import { Omnicast } from "@example/shared/types/index.ts";

export class Wire {
  static Adopted = Omnicast.Cat.Adopted;
  static Opened = Omnicast.Cattery.Opened;
}

export const sse = Sse({
  url: "http://localhost:8080",
  actions: Wire,
});
