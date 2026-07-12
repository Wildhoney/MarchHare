import { Action } from "march-hare";
import {
  Broadcast,
  Omnicast,
  type Payload,
} from "@example/shared/types/index.ts";

export type Model = {
  cats: Payload.Cat[];
};

export class Actions {
  static OpenNew = Action("Cattery.OpenNew");
  static Broadcast = Broadcast;
  static Omnicast = Omnicast;
}
