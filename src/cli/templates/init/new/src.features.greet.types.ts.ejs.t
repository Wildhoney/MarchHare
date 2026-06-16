---
to: src/features/greet/types.ts
---
import { Action, Distribution } from "march-hare";
import { Broadcast } from "@shared/types/index.ts";

export type Model = {
  count: number;
};

export class Actions {
  static Click = Action("Greet.Click");
  static Broadcast = Broadcast;
}

export class Multicast {
  static Pulse = Action<number>("Greet.Pulse", Distribution.Multicast);
}
