import { Action, Distribution } from "march-hare";

export namespace Env {
  export type Cat = {
    apiBase: string;
  };
}

export namespace Payload {
  export type Cat = {
    id: string;
    name: string;
    avatar: string;
  };
}

export namespace Broadcast {
  export class Actions {
    static CatAdded = Action<Payload.Cat>("Cat.Added", Distribution.Broadcast);
  }
}
