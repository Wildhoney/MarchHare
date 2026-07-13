import { Action } from "march-hare";
import { AppActions, type Payload } from "@example/shared/types/index.ts";

export type Model = {
  cats: Payload.Cat[];
};

export class Actions extends AppActions {
  static OpenNew = Action("Cattery.OpenNew");
}
