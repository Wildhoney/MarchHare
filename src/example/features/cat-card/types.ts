import { Action, Distribution } from "march-hare";
import type { Payload } from "@example/shared/types/index.ts";

export type Props = {
  cat: Payload.Cat;
};

export class Multicast {
  static Update = Action<Payload.Cat>("CatCard.Update", Distribution.Multicast);
}
