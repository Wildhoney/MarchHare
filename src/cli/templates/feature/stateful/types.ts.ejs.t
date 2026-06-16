---
to: src/features/<%= name %>/types.ts
---
import { Action, Distribution } from "march-hare";

export type Model = {
  count: number;
};

export class Actions {
  static Tick = Action("<%= pascalName %>.Tick");
}

export class Multicast {
  static Update = Action<number>("<%= pascalName %>.Update", Distribution.Multicast);
}
