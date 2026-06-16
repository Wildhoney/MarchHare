---
to: src/app/pages/<%= name %>/types.ts
---
import { Action } from "march-hare";

export type Model = {
  ready: boolean;
};

export class Actions {
  static Ready = Action("<%= pascalName %>.Ready");
}
