import { Action, Distribution } from "march-hare";
import { AppActions } from "@example/shared/types/index.ts";
import type { Cat } from "@example/shared/resources/cat/types.ts";

export type Model = {
  image: Cat.Image | null;
};

export class Actions extends AppActions {
  static Click = Action("AddCat.Click");
}

export class Multicast {
  static Pending = Action<boolean>("AddCat.Pending", Distribution.Multicast);
}
