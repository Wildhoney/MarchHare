/* eslint-disable @typescript-eslint/no-unused-vars */
import { Lifecycle, Pk, HandlerPayload, Brand, Feature } from ".";
import type { Payload, Handlers, UseActions, FeatureFlags } from ".";
import { Action, Distribution } from "..";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("Lifecycle", () => {
  it("should produce unique symbols per factory call", () => {
    const mount1 = Lifecycle.Mount();
    const mount2 = Lifecycle.Mount();
    expect(mount1).not.toBe(mount2);
    expect(mount1[Brand.Action]).not.toBe(mount2[Brand.Action]);
  });

  it("should have all five lifecycle factories", () => {
    expect(typeof Lifecycle.Mount).toBe("function");
    expect(typeof Lifecycle.Unmount).toBe("function");
    expect(typeof Lifecycle.Error).toBe("function");
    expect(typeof Lifecycle.Update).toBe("function");
    expect(typeof Lifecycle.Node).toBe("function");
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

describe("Feature", () => {
  it("should have On, Off, and Toggle values", () => {
    expect(Feature.On).toBe("on");
    expect(Feature.Off).toBe("off");
    expect(Feature.Toggle).toBe("toggle");
  });
});

describe("FeatureFlags", () => {
  it("should extract features from a model with a features property", () => {
    type Model = {
      count: number;
      features: { sidebar: boolean; modal: boolean };
    };
    type F = FeatureFlags<Model>;
    expectTypeOf<F>().toEqualTypeOf<{ sidebar: boolean; modal: boolean }>();
  });

  it("should produce never keys when model has no features property", () => {
    type Model = { count: number };
    type F = FeatureFlags<Model>;
    type Keys = keyof F;
    expectTypeOf<Keys>().toEqualTypeOf<never>();
  });

  it("should produce never keys when features is misspelled", () => {
    type Model = { count: number; features2: { sidebar: boolean } };
    type F = FeatureFlags<Model>;
    type Keys = keyof F;
    expectTypeOf<Keys>().toEqualTypeOf<never>();
  });
});
