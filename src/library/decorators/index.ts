/* eslint-disable @typescript-eslint/no-explicit-any */

export function Distributed() {
  return function (_value: unknown, context: ClassFieldDecoratorContext) {
    if (context.kind !== "field" || !context.static) {
      throw new Error(
        "Chizu: @Distributed decorator can only be used on static class fields.",
      );
    }

    return function (initialValue: any): any {
      const symbol = <symbol>initialValue;
      const name = symbol.description?.replace("chizu.action/", "");
      return Symbol(`chizu.action/distributed/${name}`);
    };
  };
}

export default {
  Synchronous(target: any, propertyKey: string) {
    return function (...args: any[]) {
      return target[propertyKey](...args);
    };
  },
  Debounce(target: any, propertyKey: string) {
    return function (...args: any[]) {
      return target[propertyKey](...args);
    };
  },
};
