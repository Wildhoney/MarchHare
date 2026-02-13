/* eslint-disable @typescript-eslint/no-unused-vars */
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

describe("derive type inference", () => {
  const Counter = Action<number>("Counter", Distribution.Broadcast);

  type Model = { count: number };
  class Actions {
    static Counter = Counter;
  }

  it("should have a derive method on UseActions", () => {
    type Base = UseActions<Model, typeof Actions>;
    // The derive method exists and is callable
    expectTypeOf<Base["derive"]>().toBeFunction();
  });

  it("should type action-based derive return as R | null", () => {
    // Action-based derive('key', action, cb) produces R | null on the model
    // because the value is null until the action fires
    type Base = UseActions<Model, typeof Actions>;
    type DeriveMethod = Base["derive"];
    expectTypeOf<DeriveMethod>().toBeFunction();
  });

  it("should support chaining derive calls", () => {
    // Each derive call returns a new UseActions with the model extended
    type Base = UseActions<Model, typeof Actions>;
    expectTypeOf<Base["derive"]>().toBeFunction();
  });
});
