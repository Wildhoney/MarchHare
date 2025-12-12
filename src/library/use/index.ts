import { Args, Field, Instance, Method } from "./types";
import { context, contexts } from "./utils";

export { context } from "./utils";

export const use = {
  serial() {
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const self = this as Instance;
        const ƒ = self[field.name] as Method;
        self[field.name] = async (args: Args) => {
          contexts.get(self)?.controller.abort();
          contexts.set(self, args[context]);
          return await ƒ.call(self, args);
        };
      });
    };
  },
};
