import * as resource from "./resources.ts";
import type { Handler } from "./types.ts";

export { cat } from "./resources.ts";

export const catHandler: Handler["Get"] = async (context) => {
  const cat = await context.actions
    .resource(resource.cat({ id: 5 }))
    .exceeds({ minutes: 5 })
    .coalesce();
  context.actions.produce(({ model }) => void (model.cat = cat));
};
