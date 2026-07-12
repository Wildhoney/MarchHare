import { Action, Distribution, Omnicast as Omni } from "march-hare";
import { z } from "zod";
import { filters } from "@example/shared/utils/filter/index.ts";

export namespace Env {
  export type Cat = {
    apiBase: string;
  };
}

export type Envs = Env.Cat;

export namespace Payload {
  export const Cat = z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string(),
    filter: z.enum(filters),
  });
  export type Cat = z.infer<typeof Cat>;

  export const Adoption = z.object({
    image: z.object({
      id: z.string(),
      url: z.string(),
      width: z.number(),
      height: z.number(),
    }),
    cat: Cat,
  });
  export type Adoption = z.infer<typeof Adoption>;
}

export namespace Broadcast {
  export class Cat {
    static Added = Action<Payload.Cat>("Cat.Added", Distribution.Broadcast);
  }
}

export namespace Omnicast {
  export class Cat {
    static Adopted = Omni("Cat.Adopted", Payload.Adoption);
  }

  export class Cattery {
    static Opened = Omni("Cattery.Opened");
  }
}
