---
to: src/features/<%= name %>/types.ts
---
import { Action, Distribution } from "march-hare";

export type Props = {
  label: string;
};

export class Multicast {
  static Update = Action<string>("<%= pascalName %>.Update", Distribution.Multicast);
}
