import { Args, Field } from "./types";
import { context, contexts } from "./utils";

export { context } from "./utils";

export const use = {
  serial() {
    return function (_: unknown, field: Field) {
      field.addInitializer(function () {
        const ƒ = this[field.name];
        this[field.name] = async (args: Args) => {
          contexts.get(this)?.controller.abort();
          contexts.set(this, args[context]);
          return await ƒ.call(this, args);
        };
      });
    };
  },
};
