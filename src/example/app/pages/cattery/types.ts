import { Broadcast, type Payload } from "@example/shared/types/index.ts";

export type Model = {
  cats: Payload.Cat[];
};

export class Actions {
  static Broadcast = Broadcast.Actions;
}
