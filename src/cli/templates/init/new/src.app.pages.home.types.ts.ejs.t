---
to: src/app/pages/home/types.ts
---
import { Broadcast } from "@shared/types/index.ts";

export type Model = {
  greeting: string | null;
};

export class Actions {
  static Broadcast = Broadcast;
}
