---
to: src/shared/types/index.ts
---
import { Action, Distribution } from "march-hare";

export namespace Env {
  export type <%= env %> = {
    apiBase: string;
  };
}

export type Envs = Env.<%= env %>;

export namespace Payload {
  export type Greeting = {
    message: string;
    at: number;
  };
}

export namespace Broadcast {
  export const Greeted = Action<string>("Greeted", Distribution.Broadcast);
}
