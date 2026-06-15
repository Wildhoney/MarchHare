import { Action, Distribution } from "march-hare";

export namespace Env {
  export type Cat = {
    apiBase: string;
  };
}

export type Envs = Env.Cat;

export namespace Payload {
  export type Cat = {
    id: string;
    name: string;
    avatar: string;
  };
}

export namespace Broadcast {
  export class Cat {
    static Added = Action<Payload.Cat>("Cat.Added", Distribution.Broadcast);
  }
}
