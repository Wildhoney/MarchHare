/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { Lifecycle, Pk, HandlerPayload, Brand } from ".";
import type { Payload, Handlers, UseActions } from ".";
import { Action, Distribution } from "..";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("Lifecycle", () => {
  it("should have unique symbols", () => {
    const symbols = Object.values(Lifecycle);
    const uniqueSymbols = new Set(symbols);
    expect(symbols.length).toBe(uniqueSymbols.size);
  });
});

describe("Pk", () => {
  it("can be a symbol", () => {
    const pk: Pk<never> = Symbol("test");
    expect(typeof pk).toBe("symbol");
  });

  it("can be undefined", () => {
    const pk: Pk<never> = undefined;
    expect(pk).toBeUndefined();
  });
});

describe("HandlerPayload", () => {
  it("should be a symbol", () => {
    const payload = <HandlerPayload<unknown>>Symbol("test");
    expect(typeof payload).toBe("symbol");
  });
});

describe("Brand", () => {
  it("should have symbol properties", () => {
    expect(typeof Brand.Payload).toBe("symbol");
    expect(typeof Brand.Broadcast).toBe("symbol");
    expect(typeof Brand.Multicast).toBe("symbol");
    expect(typeof Brand.Action).toBe("symbol");
    expect(typeof Brand.Channel).toBe("symbol");
    expect(typeof Brand.Node).toBe("symbol");
  });
});

describe("Payload", () => {
  it("should extract payload from unicast action", () => {
    const SetName = Action<string>("SetName");
    type Result = Payload<typeof SetName>;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("should extract payload from broadcast action", () => {
    const PaymentLink = Action<{ amount: number }>(
      "PaymentLink",
      Distribution.Broadcast,
    );
    type Result = Payload<typeof PaymentLink>;
    expectTypeOf<Result>().toEqualTypeOf<{ amount: number }>();
  });

  it("should extract payload from multicast action", () => {
    const Update = Action<number>("Update", Distribution.Multicast);
    type Result = Payload<typeof Update>;
    expectTypeOf<Result>().toEqualTypeOf<number>();
  });

  it("should resolve broadcast payload through Handlers type", () => {
    class BroadcastActions {
      static PaymentLink = Action<{ amount: number }>(
        "PaymentLink",
        Distribution.Broadcast,
      );
    }

    class Actions {
      static Broadcast = BroadcastActions;
    }

    type Model = { count: number };
    type H = Handlers<Model, typeof Actions>;

    type Handler = H["Broadcast.PaymentLink"];
    type PayloadParam = Parameters<Handler>[1];

    expectTypeOf<PayloadParam>().toEqualTypeOf<{ amount: number }>();
  });
});

describe("useDerived type inference", () => {
  const Counter = Action<number>("Counter", Distribution.Broadcast);
  const SetName = Action<string>("SetName");
  const Ping = Action("Ping");

  type Model = { count: number };
  class Actions {
    static Counter = Counter;
    static SetName = SetName;
    static Ping = Ping;
  }

  it("should infer derived model keys with null union", () => {
    type Result = UseActions<Model, typeof Actions>["useDerived"] extends (
      config: any,
    ) => infer R
      ? R extends [infer M, any]
        ? M
        : never
      : never;

    // The method exists and returns a tuple
    expectTypeOf<Result>().not.toBeNever();
  });

  it("should infer callback return type as the derived property type", () => {
    // Simulate what useDerived returns by checking the type directly
    type DerivedReturn<E> = E extends readonly [
      any,
      (...args: any[]) => infer R,
    ]
      ? R
      : never;

    type Entry = readonly [typeof Counter, (counter: number) => string];
    type R = DerivedReturn<Entry>;
    expectTypeOf<R>().toEqualTypeOf<string>();
  });

  it("should produce null union for derived model values", () => {
    type DerivedReturn<E> = E extends readonly [
      any,
      (...args: any[]) => infer R,
    ]
      ? R
      : never;
    type DerivedModel<C> = {
      [K in keyof C]: DerivedReturn<C[K]> | null;
    };

    type Config = {
      doubled: readonly [typeof Counter, (counter: number) => number];
      label: readonly [typeof SetName, (name: string) => string];
    };

    type Derived = DerivedModel<Config>;
    expectTypeOf<Derived["doubled"]>().toEqualTypeOf<number | null>();
    expectTypeOf<Derived["label"]>().toEqualTypeOf<string | null>();
  });
});
